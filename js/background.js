virgoAPI = new VirgoAPI(["https://us.eagle.virgo.network:8000/","https://eu.eagle.virgo.network:8000/","https://ap.eagle.virgo.network:8000/","https://34.217.105.127:8000/"]);
wallet = null;
lastShowedSetupPwMsg = 0;

browser.storage.local.get("wallet").then(
    function(res){//on success
        if (res.wallet === undefined)
            generateWallet();
        else {
            var foundWallet = Wallet.fromJSON(res.wallet);
            if (foundWallet !== false) {
                wallet = foundWallet;
                wallet.afterLoad();
            }
        }
    },
    function(error){//on error
        console.log("error: " + error);
    }
);

browser.storage.local.get("providers").then(
    function(res) {
         if (res.providers === undefined)
            return;
        
        for (const provider of res.providers)
            virgoAPI.providersWatcher.addProvider(provider);
    },
    function(error){//on error
        console.log("error: " + error);
    }
);

browser.storage.local.get("lastShowedSetupPwMsg").then(
    function(res){//on success
        if (res.lastShowedSetupPwMsg !== undefined)
            lastShowedSetupPwMsg = res.lastShowedSetupPwMsg;
    }
);

function generateWallet() {
    wallet = Wallet.generate();
    wallet.save();
}

function forgetWallet() {
    browser.storage.local.remove("wallet");
    browser.storage.local.remove("lastShowedSetupPwMsg");
    wallet = null;
}

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.command) {
        case "isConnected":
            sendResponse(virgoAPI.providersCount() > 0);
            break;
        case "getBaseInfos":
            if (wallet == null) {
                sendResponse({"locked": true});
                return;
            }
            
            sendResponse({"address": wallet.getAddress(), "isEncrypted": wallet.isEncrypted(), "showPasswordMsg": !wallet.isEncrypted() && lastShowedSetupPwMsg+60000 < Date.now()});
            break;
        
        case "hiddenPwMsg":
            lastShowedSetupPwMsg = Date.now();
            browser.storage.local.set({"lastShowedSetupPwMsg": lastShowedSetupPwMsg});
            break;
        
        case "getBalance":
            sendResponse(wallet.getBalance());
            break;

        case "getPendingBalance":
            sendResponse(wallet.getPendingBalance());
            break;
        
        case "getTransactions":
            var values = Array.from(wallet.transactions.keys());
            sendResponse(values);
            break;
        
        case "getTransaction":
            if (wallet.transactions.has(request.hash)) {
                var tx = wallet.transactions.get(request.hash);
                var status = 0;
                var confirmations = 0;
                if (tx.state !== undefined){
                    status = tx.state.status;
                    confirmations = tx.state.confirmations;
                }
                
                sendResponse({"hash": tx.hash, "impact": tx.impact, "date": tx.date, "status": status, "confirmations": confirmations, "address": tx.address});
            }
            break;
        case "sendTransaction":
            (new TransactionBuilder()).address(wallet.getAddress()).output(request.recipient, request.amount).callback(function(result){
                if (result !== false){
                    let tx = Transaction.fromJSON(result.transaction);
                    for (var address of wallet.addresses)
                        address.addTx(tx, [tx]);
                        
                    wallet.save();
                }
                sendResponse(result);
            }).send(request.password);
            break;
        case "newPassword":
            if(!wallet.encrypt(request.newPassword, request.password)){
                sendResponse(false);
                return;
            }
            browser.storage.local.set({wallet: wallet.toJSON()});
            sendResponse(true);
            break;
        case "unlock":
            browser.storage.local.get("wallet").then(
                function(res){//on success
                    if (res.wallet === undefined){
                        generateWallet();
                        sendResponse({"address": wallet.getAddress(), "isEncrypted": wallet.isEncrypted()});
                    } else {
                        var foundWallet = Wallet.fromJSON(res.wallet, request.password);
                        if (foundWallet !== false) {
                            wallet = foundWallet;
                            wallet.afterLoad();
                            sendResponse({"address": wallet.getAddress(), "isEncrypted": wallet.isEncrypted()});
                            return;
                        }
                        sendResponse({"locked": true});
                    }
                },
                function(error){//on error
                    console.log("error: " + error);
                    sendResponse({"locked": true});
                }
            );
            break;
        case "getProviders":
            sendResponse(Array.from(virgoAPI.providersWatcher.providersByHostname.keys()));
            break;
        case "setProviders":
            const oldProviders = Array.from(virgoAPI.providersWatcher.providersByHostname.keys());
            for (const provider of request.providers) {
                virgoAPI.providersWatcher.addProvider(provider);
                const index = oldProviders.indexOf(provider);
                if (index > -1)
                  oldProviders.splice(index, 1);
            }
            
            for (const provider of oldProviders)
                virgoAPI.providersWatcher.removeProvider(provider);
                
            browser.storage.local.set({providers: request.providers});
            sendResponse(true);
            break;
        case "resetWallet":
            for (const address of wallet.addresses){
                address.transactions = new Map();
                address.waitedTxs = new Map();
                address.balance = 0;
                address.pendingBalance = 0;
            }
            
            wallet.transactions = new Map();
            wallet.transactionsStates = new Map();
            wallet.save();
            sendResponse(true);
            break;
    }
    //use return true for async response
    return true;
});

setInterval(function(){
    if (wallet === undefined) return;
    wallet.update();
}, 5000);

