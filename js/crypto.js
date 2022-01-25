class ECDSA {
 
    static sign(hash, privateKey){
        return privateKey.sign(hash);
    }

    static verify(hash, sig, publicKey){
        try {
            return publicKey.verify(hash, sig);
        } catch(e) {
            console.log(e);
            return false;
        }
    }
 
    static generatePrivateKey(){
        var pair = sjcl.ecc.ecdsa.generateKeys(sjcl.ecc.curves.k256);
        return pair.sec;
    }
    
    static getPublicKey(privateKey){
        var pub = sjcl.ecc.curves.k256.G.mult(privateKey._exponent);
        return new sjcl.ecc.ecdsa.publicKey(sjcl.ecc.curves.k256, pub);
    }
    
    static pad_with_zeroes(number, length) {
        var retval = '' + number;
        while (retval.length < length) {
            retval = '0' + retval;
        }
        return retval;
    }
    
    static decodeSig(sig){
      var r = sig.substr(0, sig.length/2).replace(/\b00/g, '');
      var s = sig.substr(sig.length/2, sig.length).replace(/\b00/g, '');
      return Converter.hexToBytes(r + s);
    }
    
    static encodeSig(sig){
      var r = "00" + sig.substr(0, sig.length/2);
      var s = "00" + sig.substr(sig.length/2, sig.length);
      return r + s;
    }
    
    /**
     * Point decompress secp256k1 curve
     * @param {string} Compressed representation in hex string
     * @return {string} Uncompressed representation in hex string
     */
    static ECPointDecompress( comp ) {
        var prime = new bigInt('fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f', 16);
        var pIdent = prime.add(1).divide(4);
      
        var signY = new Number(comp[1]) - 2;
        var x = new bigInt(comp.substring(2), 16);
        // y mod p = +-(x^3 + 7)^((p+1)/4) mod p
        var y = x.modPow(3, prime).add(7).mod(prime).modPow( pIdent, prime );
        // If the parity doesn't match it's the *other* root
        if( y.mod(2).toJSNumber() !== signY ) {
            // y = prime - y
            y = prime.subtract( y );
        }
        return '04' + ECDSA.pad_with_zeroes(x.toString(16), 64) + ECDSA.pad_with_zeroes(y.toString(16), 64);
    }
    
    /**
    * Point compress elliptic curve key
    * @param {Uint8Array} x component
    * @param {Uint8Array} y component
    * @return {Uint8Array} Compressed representation
    */
    static ECPointCompress( x, y ) {
       const out = new Uint8Array( x.length + 1 );
    
       out[0] = 2 + ( y[ y.length-1 ] & 1 );
       out.set( x, 1 );
    
       return Array.from(out);
    }    
    
}


const base58_chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const create_base58_map = () => {
  const base58M = Array(256).fill(-1);
  for (let i = 0; i < base58_chars.length; ++i)
    base58M[base58_chars.charCodeAt(i)] = i;

  return base58M;
};

const base58Map = create_base58_map();

const binary_to_base58 = uint8array => {
  const result = [];

  for (const byte of uint8array) {
    let carry = byte;
    for (let j = 0; j < result.length; ++j) {
      const x = (base58Map[result[j]] << 8) + carry;
      result[j] = base58_chars.charCodeAt(x % 58);
      carry = (x / 58) | 0;
    }
    while (carry) {
      result.push(base58_chars.charCodeAt(carry % 58));
      carry = (carry / 58) | 0;
    }
  }

  for (const byte of uint8array)
    if (byte) break;
    else result.push('1'.charCodeAt(0));

  result.reverse();

  return String.fromCharCode(...result);
};

const base58_to_binary = base58String => {
  if (!base58String || typeof base58String !== 'string')
    throw new Error("Expected base58 string but got " + base58String);
  if (base58String.match(/[IOl0]/gm))
    throw new Error("Invalid base58 character");
  const lz = base58String.match(/^1+/gm);
  const psz = lz ? lz[0].length : 0;
  const size = ((base58String.length - psz) * (Math.log(58) / Math.log(256)) + 1) >>> 0;

  return new Uint8Array([
    ...new Uint8Array(psz),
    ...base58String
      .match(/.{1}/g)
      .map(i => base58_chars.indexOf(i))
      .reduce((acc, i) => {
        acc = acc.map(j => {
          const x = j * 58 + i;
          i = x >> 8;
          return x;
        });
        return acc;
      }, new Uint8Array(size))
      .reverse()
      .filter((lastValue => value => (lastValue = lastValue || value))(false))
  ]);
};

class Converter {
    
    static changeEndianness(string){
        const result = [];
        let len = string.length - 2;
        while (len >= 0) {
          result.push(string.substr(len, 2));
          len -= 2;
        }
        return result.join('');
    }
    
    static longToByteArrayLE(long){
      var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
  
      for (var index = byteArray.length-1; index >= 0; index --) {
          var byte = long & 0xff;
          byteArray [ index ] = byte;
          long = (long - byte) / 256 ;
      }
  
      return byteArray;
    }
    
    static longToByteArray(long) {
        var byteArray = [];
    
        while(long > 0) {
            var byte = long & 0xff;
            byteArray.push(byte);
            long = (long - byte) / 256 ;
        }
    
        return byteArray;
    }
    
    static byteArrayToLong(byteArray) {
        var value = 0;
        for ( var i = byteArray.length - 1; i >= 0; i--) {
            value = (value * 256) + byteArray[i];
        }
    
        return value;
    }
    
    static addressify(base, identifier){
        var shaHash = sjcl.hash.sha256.hash(sjcl.codec.bytes.toBits(base));
        var ripeMd = sjcl.codec.bytes.fromBits(sjcl.hash.ripemd160.hash(shaHash));
        var hashWithIdentifier = Array.prototype.concat(identifier, ripeMd);
        var checksum = sjcl.codec.bytes.fromBits(sjcl.hash.sha256.hash(sjcl.hash.sha256.hash(sjcl.codec.bytes.toBits(hashWithIdentifier)))).slice(0, 4);
        return binary_to_base58(Array.prototype.concat(hashWithIdentifier, checksum));
    }
    
    static validateAddress(address, identifier){
      try {
        var decoded = base58_to_binary(address);
        if (decoded < 4) return false;
        var data = decoded.slice(0, decoded.length - 4);
        var checksum = decoded.slice(decoded.length - 4);
        var actualChecksum = sjcl.codec.bytes.fromBits(sjcl.hash.sha256.hash(sjcl.hash.sha256.hash(sjcl.codec.bytes.toBits(data)))).slice(0, 4);
        
        if(!Converter.arraysEquals(checksum, actualChecksum))
          return false;
        
        return Converter.arraysEquals(identifier, data.slice(0, identifier.length));
      } catch(e) {
        return false;
      }

    }
    
    static bytesToHex(byteArray) {
        return Array.from(byteArray, function(byte) {
          return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join('');
    }
    
    static hexToBytes(hex) {
        for (var bytes = [], c = 0; c < hex.length; c += 2){
          var i = parseInt(hex.substr(c, 2), 16);
          if (isNaN(i)) throw 'given string is not hexadecimal!';
          bytes.push(i);
        }
        
        return bytes;
    }
    
    static hexToInt(hex) {
        return parseInt(hex, 16);
    }
    
    static Utf8ArrayToStr(array) {
        var out, i, len, c;
        var char2, char3;
    
        out = "";
        len = array.length;
        i = 0;
        while(i < len) {
        c = array[i++];
        switch(c >> 4)
        { 
          case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
            // 0xxxxxxx
            out += String.fromCharCode(c);
            break;
          case 12: case 13:
            // 110x xxxx   10xx xxxx
            char2 = array[i++];
            out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
            break;
          case 14:
            // 1110 xxxx  10xx xxxx  10xx xxxx
            char2 = array[i++];
            char3 = array[i++];
            out += String.fromCharCode(((c & 0x0F) << 12) |
                           ((char2 & 0x3F) << 6) |
                           ((char3 & 0x3F) << 0));
            break;
        }
        }
    
        return out;
    }
    
    static arraysEquals(a, b) {
      if(a.length!=b.length) return false;
      else {
        for(let i = 0; i < a.length; i++)
          if(a[i]!=b[i]) return false;
      }
      return true;
    }

    static async randomWords(amount){
        let res = await fetch(browser.runtime.getURL("js/wordlists/english.json"));
        let json = await res.json();

        let words = [];

        for(const word of sjcl.random.randomWords(amount)){
            const uword = word - Math.floor(word/2**32)*2**32;
            let i = Math.floor(uword/4294967295*json.length);
            words.push(json[i]);
        }

        return words;
    }
}