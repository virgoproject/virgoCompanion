/**
 * Tabs toggle buttons
 */
$("#resumeBtn").click(function(){
    
    if ($("#resumeBtn").hasClass("active"))
        return;
    
    $("#appsBtn").removeClass("active");
    $("#appsTab").removeClass("active");
    
    $("#resumeBtn").addClass("active");
    $("#resumeTab").addClass("active");

});

$("#appsBtn").click(function(){
    if ($("#appsBtn").hasClass("active"))
        return;
    
    $("#resumeBtn").removeClass("active");
    $("#resumeTab").removeClass("active");
    
    $("#appsBtn").addClass("active");
    $("#appsTab").addClass("active");

});


/**
 * Receive tab
 */
$("#receivePopupClose").click(function(){
    $("#receivePopup").hide();
});

$("#receivePopupToggle").click(function(){
    $("#receivePopup").show();
});

$("#receivePopup").click(function(){
    $("#receivePopup").hide();
});

$("#receivePopupBox").click(function(){
    return false;
});

$("#walletAddressCopy").click(function(){
  var copyText = document.querySelector("#walletAddress");
  copyText.select();
  document.execCommand("copy");
});


/**
 * Send tab
 */
$("#sendPopupClose").click(function(){
    $("#sendPopup").hide();
});

$("#sendPopupToggle").click(function(){
    $("#sendRecipient").val("");
    $("#sendAmount").val("");
    $("#sendSpinner").hide();
    $("#sendBtn").prop('disabled', false);
    
    $("#sendPopup").show();
});

$("#sendPopup").click(function(){
    $("#sendPopup").hide();
});

$("#sendPopupBox").click(function(){
    return false;
});

$("#sendAmountMax").click(function(){
    resetSendErrors();
    
    browser.runtime.sendMessage({command: 'getBalance'})
    .then(function (response) {
        $("#sendAmount").val(VirgoAPI.formatAmount(response));
    });
});

$("#sendBtn").click(function(){
    
    var errors = false;
    
    if (!Converter.validateAddress($("#sendRecipient").val(), addrIdentifier)) {
        $("#sendInvalidRecipient").show();
        $("#sendRecipient").addClass("is-invalid");
        errors = true;
    }
    
    if ($("#sendAmount").val() <= 0 || $("#sendAmount").val() > $("#walletBalance").html()) {
        $("#sendAmount").addClass("is-invalid");
        $("#sendInvalidAmount").show();
        errors = true;
    }
    
    if (errors) return;
    
    $("#sendBtn").prop('disabled', true);
    $("#sendSpinner").show();
    browser.runtime.sendMessage({command: 'sendTransaction', recipient: $("#sendRecipient").val(), amount: VirgoAPI.amountToAtomic($("#sendAmount").val())})
    .then(function () {
        $("#sendPopup").hide();
    });
});

$("#sendRecipient").click(function(){
    resetSendErrors();
});

$("#sendAmount").click(function(){
    resetSendErrors();
});

function resetSendErrors() {
    $("#sendRecipient").removeClass("is-invalid");
    $("#sendInvalidRecipient").hide();
    
    $("#sendAmount").removeClass("is-invalid");
    $("#sendInvalidAmount").hide();
}


/**
 * Display base informations on popup
 */
browser.runtime.sendMessage({command: 'getAddress'})
.then(function (response) {
    $("#walletAddress").val(response.address);
});

/**
 * Update informations
 */
function updateInfos() {
  browser.runtime.sendMessage({command: 'getBalance'})
  .then(function (response) {
      $("#walletBalance").html(VirgoAPI.formatAmount(response));
  });
  
  browser.runtime.sendMessage({command: 'getPendingBalance'})
  .then(function (response) {
      if (response != 0) {
          $("#walletPendingText").show();
          $("#tabsBtns").addClass("tabsBtnReduced");
          $("#walletPendingBalance").html(VirgoAPI.formatAmount(response));
      }else{
          $("#walletPendingText").hide();
          $("#tabsBtns").removeClass("tabsBtnReduced");
      }
  });
  
  browser.runtime.sendMessage({command: 'getTransactions'})
  .then(function (response) {
      for (const tx of response) {
          browser.runtime.sendMessage({command: 'getTransaction', hash: tx})
          .then(function (resp) {
              if ($("#" + resp.hash).length == 0) {
                  let elem = $("#baseActivity").clone();
                  $("#resumeTab").append(elem);
                  elem.attr("id", resp.hash);
                  elem.find("[data-amount]").html(VirgoAPI.formatAmount(resp.impact));
                  
                  elem.attr("data-date", resp.date);
                  var date = new Date(resp.date);
                  var options = {month: "short", day: "numeric"};
                  
                  elem.find("[data-date]").html(date.toLocaleDateString("en-US", options));
                  if (resp.impact > 0) {
                      elem.find("[data-type]").html("Received");
                      elem.find("[data-symbol]").html("<i class='fas fa-arrow-down'></i>");
                      
                  }
                  
                  elem.find("[data-addr]").html(resp.address);
                  
                  elem.show();
                  tinysort("#resumeTab > div",{attr:"data-date", order:'desc'});
              }else{
                  let elem = $("#" + resp.hash);
                  if (resp.status != 2 && resp.confirmations < 8) {
                      var progressBar = elem.find("[data-progress]");
                      progressBar.show();
                      elem.find("[data-symbol]").hide();
                      elem.find("[data-refused]").hide();
                      progressBar.attr("progress", Math.min(100, 10 * (resp.confirmations+1)));
                  }else if (resp.status == 1) {
                      elem.find("[data-symbol]").show();
                      elem.find("[data-progress]").hide();
                      elem.find("[data-refused]").hide();
                  }else if (resp.status == 2) {
                      elem.find("[data-refused]").show();
                      elem.find("[data-symbol]").hide();
                      elem.find("[data-progress]").hide();
                  }
              }
          });
      }
  });
  
  
  browser.runtime.sendMessage({command: 'isConnected'})
  .then(function (response) {
      if (response) {
          $("#headerStatusLight").removeClass("connecting");
          $("#headerStatusText").html("Connected");
      }else if (!$("#headerStatusLight").hasClass("connecting")) {
          $("#headerStatusLight").addClass("connecting");
          $("#headerStatusText").html("Connecting");
      }
  });
}

setInterval(function(){
  updateInfos();
}, 500);

updateInfos();


class ProgressRing extends HTMLElement {
  constructor() {
    super();
    const stroke = this.getAttribute('stroke');
    const radius = this.getAttribute('radius');
    const normalizedRadius = radius - stroke * 2;
    this._circumference = normalizedRadius * 2 * Math.PI;
    
    this._root = this.attachShadow({mode: 'open'});
    this._root.innerHTML = `
      <svg
        height="${radius * 2}"
        width="${radius * 2}"
       >
         <circle
           stroke="#644696"
           stroke-dasharray="${this._circumference} ${this._circumference}"
           style="stroke-dashoffset:${this._circumference}"
           stroke-width="${stroke}"
           fill="transparent"
           r="${normalizedRadius}"
           cx="${radius}"
           cy="${radius}"
        />
      </svg>

      <style>
        circle {
          transition: stroke-dashoffset 0.35s;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }
      </style>
    `;
  }
  
  setProgress(percent) {
    const offset = this._circumference - (percent / 100 * this._circumference);
    const circle = this._root.querySelector('circle');
    circle.style.strokeDashoffset = offset; 
  }

  static get observedAttributes() {
    return ['progress'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'progress') {
      this.setProgress(newValue);
    }
  }
}

window.customElements.define('progress-ring', ProgressRing);


   /* pair = sjcl.ecc.ecdsa.generateKeys(sjcl.ecc.curves.k256);
    privhex = sjcl.codec.hex.fromBits(pair.sec.get());
    
    sec = new sjcl.ecc.ecdsa.secretKey(
    sjcl.ecc.curves.k256,
    sjcl.ecc.curves.k256.field.fromBits(sjcl.codec.hex.toBits(privhex)));
    
    pub = sjcl.ecc.curves.k256.G.mult(sec._exponent);
    fpub = new sjcl.ecc.ecdsa.publicKey(sjcl.ecc.curves.k256, pub);
    
    sig = ECDSA.sign(sjcl.hash.sha256.hash("Hello"), sec);
    console.log("sig: " + sig);
    console.log(ECDSA.verify(sjcl.hash.sha256.hash("Hello"), sig, fpub));
    
    var x = "006046BE451AE76572D5FB52D0658138100F1ABCD69B5218776F95F16562CC68D000B62DDBFE08A75D5A190633E738BAA566FBA2ED038BDDC38910C59025AE9F57CD";
    var r = x.substr(0, x.length/2);
    var s = x.substr(x.length/2, x.length);
    console.log(r);
    console.log(s);
    
    var digest = Secp256k1.uint256("7ec8260a39fc12f50deee5e43f0ababf0b6c5e825dbfb22a67da4d3f89bbe9a2", 16);
    
    var pub = "c93b5bf115ed8bc56f215623a1e5137a6412eab165e6d44201450bb1fea6ac773b193cfba83340eb411c7c5f57b81cfa9d0240661770722f3c6c3bc557c2801e";
    
    var pubX = Secp256k1.uint256(pub.substr(0, pub.length/2), 16);
    var pubY = Secp256k1.uint256(pub.substr(pub.length/2, pub.length), 16);
    
    var sigR = Secp256k1.uint256(r, 16);
    var sigS = Secp256k1.uint256(s, 16);
    
    var isValidSig = Secp256k1.ecverify(pubX, pubY, sigR, sigS, digest);
    console.log("result: " + isValidSig);
    console.log("R: " + sigR);
    console.log("S: " + sigS);
    console.log("Hash: " + digest);**/