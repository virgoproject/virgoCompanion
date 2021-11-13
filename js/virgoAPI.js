//Bytes used as network identifier when calcultating addresses
const addrIdentifier = [15, 199];
const decimals = 8;

class VirgoAPI {
       
    constructor(hosts){
        this.providersWatcher = new ProvidersWatcher(1000);
        
        if (typeof hosts === "string" && validURL(hosts))
            this.addProvider(hosts);
        else{
            this.providers = [];
            for (var i = 0; i < hosts.length; i++){
                if (validURL(hosts[i]))
                    addProvider(hosts[i]);
            }
        }
        
    }
    
    addProvider(host){
        this.providersWatcher.addProvider(host);
    }
    
    providersCount(){
        return this.providersWatcher.readyProviders.size;
    }
    
    getAddressTransactions(address, callback, amount, page){
        this.providers = this.providersWatcher.getProvidersByScore();
        this._getAddressTransactions(address, callback, amount, page, 0);
    }
    
    _getAddressTransactions(address, callback, amount, page, providerNum){
        var api = this;
        if (providerNum >= this.providers.length) {
            var json = {};
            json.responseCode = 404;
            callback(json);
            return;
        }
        
        var provider = this.providers[providerNum];
        provider.get("/address/" + address + "/txs/" + amount + "/" + page, function(resp){
            if (resp.status === 200) {
                block: {
                    //sanitize response
                    if (typeof resp.response.size !== "number" || resp.response.size <= 0 ||
                        resp.response.txs === undefined || !Array.isArray(resp.response.txs)) break block;
                    
                    for (var i = 0; i < resp.response.txs.length; i++)
                        if (typeof resp.response.txs[i] !== "string")
                            break block;
                        
                    var json = {};
                    json.responseCode = 200;
                    json.size = resp.response.size;
                    json.txs = resp.response.txs;
                    callback(json);
                    return;                    
                }
            }
            //not returned yet, recursive call this function with another provider
            api._getAddressTransactions(address, callback, amount, page, providerNum+1);
        });
    }
    
    getTransactions(transactionsHashes, callback){
        this.providers = this.providersWatcher.getProvidersByScore();
        this._getTransactions(transactionsHashes, callback, 0, new Map(), 0);
    }
    
    _getTransactions(transactionsHashes, callback, providerNum, foundTxs, hashNum){
        var api = this;
        
        if (providerNum >= this.providers.length) {
            var json = {};
            if (foundTxs.size > 0) {
                json.responseCode = 200;
                json.txs = foundTxs;
                callback(json);
                return;
            }
            
            json.responseCode = 404;
            callback(json);
            return;
        }
        
        var provider = this.providers[providerNum];
        var hash = transactionsHashes[hashNum];
        
        if (foundTxs.has(hash))
            api._getTransactions(transactionsHashes, callback, providerNum, foundTxs, hashNum+1);
            
        provider.get("/tx/" + hash, function(resp){
            if (resp.status === 200) {
              var transaction = Transaction.fromJSON(resp.response);
              if (transaction && hash == transaction.hash){
                foundTxs.set(hash, transaction);
                if (foundTxs.size < transactionsHashes.length) {
                  hashNum++;
                  if (hashNum < transactionsHashes.length)
                      api._getTransactions(transactionsHashes, callback, providerNum, foundTxs, hashNum);
                  else
                      api._getTransactions(transactionsHashes, callback, providerNum+1, foundTxs, 0);
                }else{
                      api._getTransactions(transactionsHashes, callback, api.providers.length, foundTxs, 0);//all transactions found, skip remaining providers and return result
                }
              }
            }else{
              hashNum++;
              if (hashNum < transactionsHashes.length)
                  api._getTransactions(transactionsHashes, callback, providerNum, foundTxs, hashNum);
              else
                  api._getTransactions(transactionsHashes, callback, providerNum+1, foundTxs, 0);
            }
        });
        
    }
    
    getTransactionsStates(transactionsHashes, callback){
        this.providers = this.providersWatcher.getProvidersByScore();
        this._getTransactionsStates(transactionsHashes, callback, 0, new Map(), 0);
    }
    
    _getTransactionsStates(transactionsHashes, callback, providerNum, foundTxs, hashNum){
        var api = this;
        if (providerNum >= this.providers.length) {
            var json = {};
            json.responseCode = 404;
            callback(json);
            return;
        }
        var hash = transactionsHashes[hashNum];
        
        if (foundTxs.has(hash))
            api._getTransactionsStates(transactionsHashes, callback, providerNum, foundTxs, hashNum+1);
        
        var provider = this.providers[providerNum];
        provider.get("/tx/" + hash + "/state", function(resp){
            if (resp.status === 200) {
                block: {
                    try {
                    
                        if (typeof resp.response.confirmations !== "number" || typeof resp.response.status !== "number")
                            break block;
                        for (var state of resp.response.outputsState) {
                            if (typeof state.amount !== "number" || typeof state.address !== "string" ||
                                !Converter.validateAddress(state.address, addrIdentifier) || typeof state.spent !== "boolean")
                                break block;
                            
                            for (var claimer of state.claimers) {
                                if (typeof claimer.id !== "string" || typeof claimer.status !== "number") {
                                    break block;
                                }
                            }
                        }

                        if ((resp.response.confirmations > 0 && typeof resp.response.beacon === "string") || resp.response.confirmations === 0) {
                            foundTxs.set(hash, resp.response);
                            if (foundTxs.size == transactionsHashes.length) {
                                callback({"responseCode": 200, "states": Array.from(foundTxs.entries())});
                                return;
                            }
                            api._getTransactionsStates(transactionsHashes, callback, providerNum, foundTxs, hashNum+1);
                            return;
                        }
                    
                    } catch(e) {
                        console.log(e);
                        break block;
                    }
                }
            }
            //not returned yet, recursive call this function with another provider
            api._getTransactionsStates(transactionsHashes, callback, providerNum+1, new Map(), 0);
        });
    }
    
    getTips(callback){
        this.providers = this.providersWatcher.getProvidersByScore();
        this._getTips(callback, 0);
    }
    
    _getTips(callback, providerNum){
        var api = this;
        if (providerNum >= this.providers.length) {
            var json = {};
            json.responseCode = 404;
            callback(json);
            return;
        }
        
        var provider = this.providers[providerNum];
        provider.get("/tips", function(resp){
            if (resp.status !== 200) {
                api._getTips(callback, providerNum+1);
                return;
            }
            
            for (var tip of resp.response) {
                if (typeof tip !== "string") {
                    api._getTips(callback, providerNum+1);
                    return;
                }
            }
            
            callback({"responseCode": 200, "tips": resp.response});
        });
        
    }
    
    sendTransaction(json, callback){
        this.providers = this.providersWatcher.getProvidersByScore();
        this._sendTransaction(json, callback, 0);
    }
    
    _sendTransaction(json, callback, providerNum){
        var api = this;
        
        if (providerNum >= this.providers.length) {
            let resp = {};
            resp.responseCode = 404;
            callback(resp);
            return;
        }
        
        var provider = this.providers[providerNum];
        provider.post("/tx", json, function(resp){
            if (resp.status !== 200) {
                api._sendTransaction(json, callback, providerNum+1);
            }
            
            let response = {};
            response.responseCode = 200;
            callback(response);
            return;
        });
    }
    
    static formatAmount(amount){
      return amount/Math.pow(10, decimals);
    }
    
    static amountToAtomic(amount){
        return Math.max(1, amount * Math.pow(10, decimals));
    }
}

class Transaction {
    
    constructor(hash, inputs, outputs, outputsByAddress, parents, sig, pubKey, date){
        this.hash = hash;
        this.inputs = inputs;
        this.outputs = outputs;
        this.outputsByAddress = outputsByAddress;
        this.parents = parents;
        this.sig = sig;
        this.pubKey = pubKey;
        this.date = date;
        this.address = Converter.addressify(pubKey, addrIdentifier);
        
        this.impactFor = [];
    }
    
    static fromJSON(json){
      try {
        var inputs = [];
        
        for (var input of json.inputs) {
            //verify hash validity
            Converter.hexToBytes(input);
            if (input.length != 64) throw "invalid sha256 hash";
            
            inputs.push(input);
        }
        
        var outputs = [];
        var outputsByAddress = new Map();
        
        for (var rowOutput of json.outputs) {
            var outElems = rowOutput.split(",");
            if (!Converter.validateAddress(outElems[0], addrIdentifier)) throw "invalid output address";
            var value = Converter.hexToInt(outElems[1]);
            outputs.push({"address": outElems[0], "value": value});
            outputsByAddress.set(outElems[0], value);
        }
        
        var parents = [];
        
        for (var parent of json.parents) {
            //verify hash validity
            Converter.hexToBytes(parent);
            if (parent.length != 64) throw "invalid sha256 hash";
            
            parents.push(parent);
        }
        
        var pubKey = Converter.hexToBytes(json.pubKey);
        var sig = ECDSA.decodeSig(json.sig);
        var iop = Array.from(new TextEncoder('utf-8').encode(JSON.stringify(json.parents) + JSON.stringify(json.inputs) + JSON.stringify(json.outputs)));
        var bits = Array.prototype.concat(iop, pubKey, Converter.longToByteArrayLE(json.date));
        var txHash = sjcl.hash.sha256.hash(sjcl.hash.sha256.hash(sjcl.codec.bytes.toBits(bits)));

        var dp = ECDSA.ECPointDecompress(json.pubKey);
        dp = dp.substr(2, dp.length);
        var pub = new sjcl.ecc.ecdsa.publicKey(sjcl.ecc.curves.k256, sjcl.codec.hex.toBits(dp));
        
        if (!ECDSA.verify(txHash, sjcl.codec.bytes.toBits(sig), pub)) return false;
        
        return new Transaction(Converter.changeEndianness(sjcl.codec.hex.fromBits(txHash)), inputs, outputs, outputsByAddress, parents, sig, pubKey, json.date);
      } catch(e) {
        return false;
      }  
    }
    
}

class TransactionBuilder {
    
    constructor(){
        this.parents = [];
        this.inputs = [];
        this.outputs = [];
        this.validateAmounts = true;
        this.callback = function(){};
    }
    
    address(address){
        this.address = address;
        return this;
    }
    
    parent(parent){
        this.parents.push(parent);
        return this;
    }
    
    input(input){
        this.inputs.push(input);
        return this;
    }
    
    output(address, value){
        this.outputs.push({"address": address, "value": value});
        return this;
    }
    
    validateAmounts(validate){
        this.validateAmounts = validate;
        return this;
    }
    
    callback(callback){
        this.callback = callback;
        return this;
    }
    
    send(password){
        if (this.address === undefined)
            throw "No address defined";
        
        if (this.outputs.length === 0)
            throw "No output defined";
        
        this.privateKey = this.address.getPrivateKey(password);
        if (!this.privateKey){
            this.callback(false);
            return;
        }
        
        this.outputsValue = 0;
        for (var output of this.outputs)
            this.outputsValue += output.value;
        
        this.inputsValue = 0;
        if (this.inputs.length === 0){
            this._retrieveInputs(1);
            return;
        }
        
        this._validateAmounts();
    }
    
    _retrieveInputs(page){
        var txBuilder = this;
        
        virgoAPI.getAddressTransactions(this.address.address, function(resp){
            
            if (resp.responseCode !== 200){
                txBuilder.callback(false);
                return;
            }
            
            virgoAPI.getTransactionsStates(resp.txs, function(resp2){
                if (resp2.responseCode !== 200){
                    txBuilder.callback(false);
                    return;
                }

                for (var state of resp2.states) {
                    if (txBuilder.inputs.includes(state[0]) || state[1].status === 2) continue;
                    
                    outputsBlock:
                    for (var output of state[1].outputsState) {
                        if (output.address !== txBuilder.address.address || output.isSpent) continue;
                        
                        for (var claimer of output.claimers)
                            if (claimer.status !== 2)
                                continue outputsBlock;
                        
                        txBuilder.inputsValue += output.amount;
                        
                        if (!txBuilder.inputs.includes(state[0]))
                            txBuilder.inputs.push(state[0]);
                        
                        if (txBuilder.inputsValue >= txBuilder.outputsValue) {
                            
                            if (txBuilder.inputsValue > txBuilder.outputsValue) {
                                txBuilder.output(txBuilder.address.address, txBuilder.inputsValue - txBuilder.outputsValue);
                            }
                            
                            txBuilder._send();
                            return;
                        }
                    }
                    
                }
                
                if (resp2.states.length < 10) {
                    //not enough funds
                    txBuilder.callback(false);
                    return;
                }
                
                txBuilder._retrieveInputs(page+1);
            });
            
        }, 10, page);
    }
    
    _validateAmounts(){
        this._send();
    }
    
    _send(){
        var txBuilder = this;
        
        if (this.parents.length === 0) {
            this._getParents();
            return;
        }
        
        var json = {};
        
        json.parents = this.parents;
        json.inputs = this.inputs;
        
        var outputs = [];
        for (var output of this.outputs)
            outputs.push(output.address + "," + Converter.bytesToHex(Converter.longToByteArrayLE(output.value)).replace(/\b0+/g, '').toUpperCase());

        json.outputs = outputs;
        
        var date = Date.now();
        json.date = date;
        
        var publicKey = ECDSA.getPublicKey(this.privateKey).get();
        var publicKeyBytes = ECDSA.ECPointCompress(sjcl.codec.bytes.fromBits(publicKey.x), sjcl.codec.bytes.fromBits(publicKey.y));
        json.pubKey = Converter.bytesToHex(publicKeyBytes);
        
        var iop = Array.from(new TextEncoder('utf-8').encode(JSON.stringify(json.parents) + JSON.stringify(json.inputs) + JSON.stringify(json.outputs)));
        var bytes = Array.prototype.concat(iop, publicKeyBytes, Converter.longToByteArrayLE(json.date));
        var txHash = sjcl.hash.sha256.hash(sjcl.hash.sha256.hash(sjcl.codec.bytes.toBits(bytes)));
        
        var sig = ECDSA.sign(txHash, this.privateKey);
        json.sig = ECDSA.encodeSig(sjcl.codec.hex.fromBits(sig));
        
        console.log(JSON.stringify(json));
        
        virgoAPI.sendTransaction(JSON.stringify(json), function(resp){
            txBuilder.callback(resp);
        });
    }
    
    _getParents(){
        var txBuilder = this;
        
        virgoAPI.getTips(function(resp){
            if (resp.responseCode !== 200) {
                txBuilder.callback(false);
                return;
            }
            
            Array.prototype.push.apply(txBuilder.parents, resp.tips);
            txBuilder._send();
        });
    }
    
}

class ProvidersWatcher {
        
    constructor(tickrate){        
        this.providersByHostname = new Map();
        this.pendingProviders = [];
        this.readyProviders = new Map();
        
        this.lastChecked = 0;
        
        var watcher = this;
        
        this.checkProvider();
        
        setInterval(function(){
            watcher.checkProvider();
        }, tickrate);
        setInterval(function(){
            watcher.updateScores();
        }, tickrate);
    }
    
    checkProvider(){
        if (this.pendingProviders.length == 0)
            return;
        
        this.checkPendingProvider(this.providersByHostname.get(this.pendingProviders.pop(this.lastChecked)));
        
        if (this.lastChecked+1 < this.pendingProviders.length)
            this.lastChecked++;
        else this.lastChecked = 0;
    }
    
    updateScores(){
        var watcher = this;
        
        for (const providerHostname of this.readyProviders.keys()) {
            const provider = this.providersByHostname.get(providerHostname);
            provider.get("/nodeinfos", function(resp){
                if (resp.status == 200){
                    watcher.readyProviders.set(provider.hostname, resp.response.BeaconChainWeight);
                    return;
                }
                
                watcher.readyProviders.delete(provider.hostname);
                watcher.pendingProviders.push(provider.hostname);
            });
        }
    }
    
    addProvider(host){
        var provider = new Provider(host);
        if (this.providersByHostname.has(provider.hostname)) return;
        this.providersByHostname.set(provider.hostname, provider);
        this.pendingProviders.push(provider.hostname);
    }
    
    checkPendingProvider(provider){
        var watcher = this;
        
        provider.get("/nodeinfos", function(resp){
            if (resp.status == 200){
                watcher.readyProviders.set(provider.hostname, resp.response.BeaconChainWeight);
                return;
            }
            watcher.pendingProviders.push(provider.hostname);
        });
    }
    
    getProvidersByScore(){
        var sortedProviders = new Map([...this.readyProviders.entries()].sort((a, b) => b[1] - a[1]));
        var providers = [];
        for (const hostname of sortedProviders){
            providers.push(this.providersByHostname.get(hostname[0]));
        }
        
        return providers;
    }
    
}

function validURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(str);
}

class Provider {
    
    constructor(hostname){
        this.hostname = hostname.replace(/\/$/, "");
    }
    
    get(method, callback){
        var req = new XMLHttpRequest();
        req.open("GET", this.hostname + method, true);
        req.responseType = "json";
        req.onreadystatechange = function() {
            if (this.readyState == 4)
                callback({"status": this.status, "response": this.response});
        };
        req.send();
    }
    
    post(method, data, callback){
        var req = new XMLHttpRequest();
        req.open("POST", this.hostname + method, true);
        req.responseType = "json";
        req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        req.onreadystatechange = function() {
            if (this.readyState == 4)
                callback({"status": this.status, "response": this.response});
        };
        req.send(data);
    }
    
}

class Address {
    
    constructor(address, privateKey, iv, salt) {
        this.address = address;
        this.privateKey = privateKey;
        this.iv = iv;
        this.salt = salt;
        
        this.transactions = new Map();
        this.waitedTxs = new Map();
        this.balance = 0;
        this.pendingBalance = 0;
    }
    
    static generate(password){
        var privateKey = ECDSA.generatePrivateKey();
        
        var publicKey = ECDSA.getPublicKey(privateKey).get();
        var publicKeyBytes = ECDSA.ECPointCompress(sjcl.codec.bytes.fromBits(publicKey.x), sjcl.codec.bytes.fromBits(publicKey.y));
        var address = Converter.addressify(publicKeyBytes, addrIdentifier);
        
        if (password === undefined)
            return new Address(address, privateKey, undefined, undefined);
        
        var salt = sjcl.random.randomWords(32);
        var iv = sjcl.random.randomWords(4);
        
        var hashedPassword = sjcl.misc.pbkdf2(password, salt, 10000, 256);
        var cipher = new sjcl.cipher.aes(hashedPassword);
        var encryptedPKey = sjcl.mode.ctr.encrypt(cipher, privateKey.get(), iv);
        return new Address(address, encryptedPKey, iv, salt);
    }
    
    static fromJSON(json){
        var address = json.address;
        
        if (json.encryptedPrivateKeyIV === undefined){
            var pKey = new sjcl.ecc.ecdsa.secretKey(
                sjcl.ecc.curves.k256,
                sjcl.ecc.curves.k256.field.fromBits(sjcl.codec.bytes.toBits(Converter.hexToBytes(json.encryptedPrivateKey))));
            return new Address(address, pKey);
        }
        var encryptedPKey = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.encryptedPrivateKey));
        var iv = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.encryptedPrivateKeyIV));
        var salt = sjcl.codec.bytes.toBits(Converter.hexToBytes(json.passwordSalt));
        return new Address(address, encryptedPKey, iv, salt);
    }
    
    toJSON(){
        var json = {};
        json.address = this.address;

        if (this.iv === undefined){
            json.encryptedPrivateKey = Converter.bytesToHex(sjcl.codec.bytes.fromBits(this.privateKey.get()));
        }else{
            json.encryptedPrivateKey = Converter.bytesToHex(sjcl.codec.bytes.fromBits(this.privateKey));
            json.encryptedPrivateKeyIV = Converter.bytesToHex(sjcl.codec.bytes.fromBits(this.iv));
            json.passwordSalt = Converter.bytesToHex(sjcl.codec.bytes.fromBits(this.salt));
        }
        
        return json;
    }
    
    isEncrypted(){
        return this.iv !== undefined;
    }
    
    checkAgainstPrivateKey(privateKey){
        var publicKey = ECDSA.getPublicKey(privateKey).get();
        var publicKeyBytes = Array.prototype.concat(sjcl.codec.bytes.fromBits(publicKey.x), sjcl.codec.bytes.fromBits(publicKey.y));
        return Converter.addressify(publicKeyBytes, addrIdentifier) == this.address;
    }
    
    getPrivateKey(password){
        if (!this.isEncrypted()) return this.privateKey;
        var hashedPassword = sjcl.misc.pbkdf2(password, this.salt, 10000, 256);

        var cipher = new sjcl.cipher.aes(hashedPassword);
        var decryptedPkeyBits = sjcl.mode.ctr.decrypt(cipher, this.privateKey, this.iv);
        
        var privateKey = new sjcl.ecc.ecdsa.secretKey(
            sjcl.ecc.curves.k256,
            sjcl.ecc.curves.k256.field.fromBits(decryptedPkeyBits));
        
        if (!this.checkAgainstPrivateKey(privateKey)) return false;
        
        return privateKey;
    }
    
}