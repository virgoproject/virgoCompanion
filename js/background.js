virgoAPI = new VirgoAPI("http://ap.eagle.virgo.network:8000");
wallet = null;

browser.storage.local.get("wallet").then(
    function(res){//on success
        if (res.wallet === undefined)
            generateWallet();
        else {
            var foundWallet = Wallet.fromJSON(res.wallet);
            if (foundWallet !== false) {
                wallet = foundWallet;
            }
        }
    },
    function(error){//on error
        console.log("error: " + error);
    }
);

function generateWallet() {
    wallet = Wallet.generate();
    browser.storage.local.set({wallet: wallet.toJSON()});
}

function forgetWallet() {
    browser.storage.local.remove("wallet");
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
            sendResponse({"address": wallet.getAddress(), "isEncrypted": wallet.isEncrypted()});
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
                }
                sendResponse(result);
            }).send(request.password);
            break;
        case "newPassword":
            wallet.encrypt(request.password);
            console.log("new wallet: ");
            console.log(wallet.toJSON());
            browser.storage.local.set({wallet: wallet.toJSON()});
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
    }
    //use return true for async response
    return true;
});

setInterval(function(){
    if (wallet === undefined) return;
    wallet.update();
}, 10000);

