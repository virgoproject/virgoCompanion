Address.prototype.addWaitedTx = function(txHash, waitingTx){
    if (!this.waitedTxs.has(txHash))
        this.waitedTxs.set(txHash, []);
        
    waitedTxs.get(txHash).push(waitingTx);
};

Address.prototype.addTx = function(transaction, retrieved){
    if (this.transactions.has(transaction.hash)) return;
    
    var total = 0;
    console.log(transaction);
    if (transaction.outputsByAddress.has(this.address))
        total += transaction.outputsByAddress.get(this.address);
    
    if (transaction.address == this.address) {
        for (var input of transaction.inputs) {
            var inVal = undefined;
            if (wallet.transactions.has(input)){
                inVal = wallet.transactions.get(input).outputsByAddress.get(this.address);
            }else if (retrieved.has(input)) {
                inVal = retrieved.get(input).outputsByAddress.get(this.address);
            }else{
                this.addWaitedTx(input, transaction);
                return;
            }
            
            if (inVal !== undefined)
                total -= inVal;
            
        }
    }
    if (total != 0) {
        if (transaction.state !== undefined){
            if (transaction.state.status == 1)
                this.balance += total;
            else if (transaction.state.status == 0)
                 this.pendingBalance += total;
        } else this.pendingBalance += total;
            
        this.transactions.set(transaction.hash, transaction);
        wallet.transactions.set(transaction.hash, transaction);
        
        if (transaction.impact === undefined)
            transaction.impact = total;
        else
            transaction.impact += total;
        
        transaction.impactFor[this.address] = total;
    }
    
    if (this.waitedTxs.has(transaction.hash)) {
        for (var waiting of this.waitedTxs.get(transaction.hash))
            this.addTx(waiting, retrieved);
    }
    
    return total;
};

Address.prototype.updateTx = function(transaction, newState){
    if (!this.transactions.has(transaction.hash)) return;
        
    if (transaction.state !== undefined) {
        if (transaction.state.status === 1)
            this.balance -= transaction.impactFor[this.address];
        
        if (transaction.state.status === 0)
            this.pendingBalance -= transaction.impactFor[this.address];
            
    }else this.pendingBalance -= transaction.impactFor[this.address];

    if (newState.status === 1)
        this.balance += transaction.impactFor[this.address];
    
    else if (newState.status === 0)
        this.pendingBalance += transaction.impactFor[this.address];
};

class Wallet {
    
    constructor(version, addresses, transactions, transactionsStates, dataKey, encryptedDataKey, encryptedDataKeyIV, passwordSalt){
        this.version = version;
        this.addresses = addresses;
        this.transactions = transactions;
        this.transactionsStates = transactionsStates;
        this.dataKey = dataKey;
        this.encryptedDataKey = encryptedDataKey;
        this.encryptedDataKeyIV = encryptedDataKeyIV;
        this.passwordSalt = passwordSalt;
    }
    
    static generate(password){
        var address = Address.generate(password);
        
        if (password === undefined)
            return new Wallet(0, [address], new Map());
        
        var salt = sjcl.random.randomWords(32);
        var passwordHash = sjcl.misc.pbkdf2(password, salt, 10000, 256);
        var dataKey = sjcl.random.randomWords(8); 
        var iv = sjcl.random.randomWords(4);
        var cipher = new sjcl.cipher.aes(passwordHash);
        var encryptedDataKey = sjcl.mode.ctr.encrypt(cipher, dataKey, iv);
        
        return new Wallet(1, [address], new Map(), new Map(), dataKey, encryptedDataKey, iv, salt);
    }
    
    static fromJSON(json, password){
        try {
            var data, encryptedDataKey, encryptedDataKeyIV, dataKey, passwordSalt;
            
            if (json.encryptedEncryptedDataKey === undefined) {
                data = json.encryptedData;
            }else{
                encryptedDataKey = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.encryptedEncryptedDataKey));
                encryptedDataKeyIV = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.encryptedEncryptedDataKeyIV));
                var encryptedData = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.encryptedData));
                var encryptedDataIV = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.encryptedDataIV));
                passwordSalt = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.passwordSalt));
                var passwordHash = sjcl.misc.pbkdf2(password, passwordSalt, 10000, 256);
                var cipher = new sjcl.cipher.aes(passwordHash);
                dataKey = sjcl.mode.ctr.decrypt(cipher, encryptedDataKey, encryptedDataKeyIV);
                
                cipher = new sjcl.cipher.aes(dataKey);
                data = JSON.parse(Converter.Utf8ArrayToStr(sjcl.codec.bytes.fromBits(sjcl.mode.ctr.decrypt(cipher, encryptedData, encryptedDataIV))));
            }
            
            let addresses = [];
            
            for (let i = 0; i < data.addresses.length; i++) {
                let address = Address.fromJSON(data.addresses[i], password);
                addresses.push(address);
            }
            
            let transactions = new Map();
            
            if (data.transactions)
                for (let i = 0; i < data.transactions.length; i++) {
                    let transaction = Transaction.fromJSON(data.transactions[i]);
                    if (transaction)
                        transactions.set(transaction.hash, transaction);
                }
            
            return new Wallet(json.version, addresses, transactions, new Map(), dataKey, encryptedDataKey, encryptedDataKeyIV, passwordSalt);
            
        } catch(e) {
            console.log(e);
            return false;
        }
        
    }
    
    afterLoad(){
        if (this.transactions.length == 0)
            return;
        
        for (let transaction of transactions) {
            for (var address of this.addresses)
                address.addTx(transaction, this.transactions);
        }
        
        this.updateStates();
    }
    
    encrypt(newPassword, password){
        for (var address of this.addresses) {
            if(!address.encrypt(newPassword, password))
                return false;
        }
        
        this.version = 1;
        this.passwordSalt = sjcl.random.randomWords(32);
        var passwordHash = sjcl.misc.pbkdf2(newPassword, this.passwordSalt, 10000, 256);
        this.dataKey = sjcl.random.randomWords(8); 
        this.encryptedDataKeyIV = sjcl.random.randomWords(4);
        var cipher = new sjcl.cipher.aes(passwordHash);
        this.encryptedDataKey = sjcl.mode.ctr.encrypt(cipher, this.dataKey, this.encryptedDataKeyIV);
        
        return true;
    }
    
    isEncrypted(){
        return this.encryptedDataKey !== undefined;
    }
    
    getAddress(){
        return this.addresses[0];
    }
    
    getPendingBalance(){
        var pendingBal = 0;
        for (var address of this.addresses)
            pendingBal += address.pendingBalance;
        
        return pendingBal;
    }
    
    getBalance(){
        var bal = 0;
        for (var address of this.addresses)
            bal += address.balance;
        
        return bal;
    }
    
    update(){
        console.log("running update");
        this._update([], 0, 1);
    }
    
    _update(toRetrieve, addrIndex, page){
        var wallet = this;
        
        if (addrIndex >= wallet.addresses.length) {
            if (toRetrieve.length > 0)
                virgoAPI.getTransactions(toRetrieve, function(resp){
                    if (resp.responseCode === 200) {
                        for (var tx of resp.txs.values()){
                            for (var address of wallet.addresses)
                                address.addTx(tx, resp.txs);
                                
                            browser.notifications.create("txNotification", {
                              "type": "basic",
                              "title": "Transaction received!",
                              "iconUrl": browser.extension.getURL("images/logoPurple.png"),
                              "message": VirgoAPI.formatAmount(tx.impact) + "VGO from " + tx.address
                            });
                            
                            wallet.save();
                        }
                        wallet.updateStates();
                    }
                    
                });
            else wallet.updateStates();
            return;
        }
        
        var address = wallet.addresses[addrIndex];
        virgoAPI.getAddressTransactions(address.address, function(resp){
            if (resp.responseCode === 200) {
                for (var txHash of resp.txs) {
                    if (!address.transactions.has(txHash) && !toRetrieve.includes(txHash))
                        toRetrieve.push(txHash);
                }

                if (address.transactions.size + toRetrieve.length >= resp.size) {
                    wallet._update(toRetrieve, addrIndex+1, 1);
                    return;
                }
                
                wallet._update(toRetrieve, addrIndex, page+1);
                
            }else wallet._update(toRetrieve, addrIndex+1, 1);
            
            
        }, 10, page);
        
    }
    
    updateStates(){
        var wallet = this;
        
        let toRetrieve = [];
        
        for (let transaction of this.transactions.values())
            if (transaction.state === undefined || transaction.state.confirmations < 16)
                toRetrieve.push(transaction.hash);
        
        if (toRetrieve.length > 0)
            virgoAPI.getTransactionsStates(toRetrieve, function(resp){
                if (resp.responseCode !== 200) return;
                for (var state of resp.states) {
                    var transaction = wallet.transactions.get(state[0]);
                    if (transaction === undefined) continue;
                    
                    if (transaction.state === undefined || transaction.state.status !== state[1].status) {
                        for (var address of wallet.addresses)
                            address.updateTx(transaction, state[1]);
                    }
                    
                    transaction.state = state[1];
                }
            });
    }
    
    toJSON(){
        var json = {};
        json.version = this.version;
        
        var data = {};
        
        var addressesJSON = [];
        for (const address of this.addresses)
            addressesJSON.push(address.toJSON());
        
        
        var transactionsJSON = [];
        
        let transactions = Array.from(this.transactions.values());
        for (const transaction of transactions)
            transactionsJSON.push(transaction.toJSON());
            
        data.addresses = addressesJSON;
        data.transactions = transactionsJSON;
        
        if (this.dataKey === undefined)
            json.encryptedData = data;
        else {
            var iv = sjcl.random.randomWords(4);
            var cipher = new sjcl.cipher.aes(this.dataKey);
            var utf8Encode = new TextEncoder();
            var text = JSON.stringify(data);
            var array = sjcl.codec.bytes.toBits(Array.from(utf8Encode.encode(text)));
            json.encryptedData = Converter.bytesToHex(sjcl.codec.bytes.fromBits(sjcl.mode.ctr.encrypt(cipher, array, iv)));
            json.encryptedDataIV = Converter.bytesToHex(sjcl.codec.bytes.fromBits(iv));
            json.encryptedEncryptedDataKey = Converter.bytesToHex(sjcl.codec.bytes.fromBits(this.encryptedDataKey));
            json.encryptedEncryptedDataKeyIV = Converter.bytesToHex(sjcl.codec.bytes.fromBits(this.encryptedDataKeyIV));
            json.passwordSalt  = Converter.bytesToHex(sjcl.codec.bytes.fromBits(this.passwordSalt));
        }
        
        return json;
    }
    
    save(){
        browser.storage.local.set({"wallet": this.toJSON()});
    }
    
}