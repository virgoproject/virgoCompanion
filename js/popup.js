var isWalletEncrypted = true;
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
    $("#sendPassword").val("");
    
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
        $("#sendAmount").trigger("input");
    });
});

$("#sendBtn").click(function(){
    
    if (isWalletEncrypted) {
        $("#sendForm1").hide();
        $("#sendForm2").show();
        return;
    }
    
    disableLoadBtn($("#sendBtn"));
    browser.runtime.sendMessage({command: 'sendTransaction', recipient: $("#sendRecipient").val(), amount: VirgoAPI.amountToAtomic($("#sendAmount").val())})
    .then(function () {
        enableLoadBtn($("#sendBtn"));
        $("#sendPopup").hide();
    });
});

$("#sendRecipient").click(function(){
    resetSendErrors();
});

$("#sendAmount").click(function(){
    resetSendErrors();
});

$("#sendPassword").click(function(){
    resetSendErrors();
});

var sendRecipientOk = false;
var sendAmountOk = false;

$("#sendAmount").on("input", function(){
    
    if ($("#sendAmount").val() == "") {
      $("#sendBtn").prop("disabled", true);
      $("#sendInvalidAmount").hide();
      $("#sendAmount").removeClass("is-invalid");
      sendAmountOk = false;
      return;
    }
    
    if ($("#sendAmount").val() <= 0 || $("#sendAmount").val() > Number.parseFloat($("#walletBalance").html())) {
        $("#sendBtn").prop("disabled", true);
        $("#sendAmount").addClass("is-invalid");
        $("#sendInvalidAmount").show();
        errors = true;
    }else{
      $("#sendInvalidAmount").hide();
      $("#sendAmount").removeClass("is-invalid");
      sendAmountOk = true;
      $("#sendBtn").prop("disabled", !sendRecipientOk);
    }
    
});

$("#sendRecipient").on("input", function(){
    if ($("#sendRecipient").val().length < 26) {
      $("#sendBtn").prop("disabled", true);
      $("#sendInvalidRecipient").hide();
      $("#sendRecipient").removeClass("is-invalid");
      sendRecipientOk = false;
      return;
    }
    
    if (!Converter.validateAddress($("#sendRecipient").val(), addrIdentifier)) {
      $("#sendInvalidRecipient").show();
      $("#sendRecipient").addClass("is-invalid");
      $("#sendBtn").prop("disabled", true);
      sendRecipientOk = false;
    }else{
      $("#sendInvalidRecipient").hide();
      $("#sendRecipient").removeClass("is-invalid");
      sendRecipientOk = true;
      $("#sendBtn").prop("disabled", !sendAmountOk);
    }
    
});

function resetSendErrors() {
    $("#sendRecipient").removeClass("is-invalid");
    $("#sendInvalidRecipient").hide();
    
    $("#sendAmount").removeClass("is-invalid");
    $("#sendInvalidAmount").hide();
    
    $("#sendPassword").removeClass("is-invalid");
    $("#sendInvalidPassword").hide();
}

$("#sendConfirmBack").click(function(){
  $("#sendForm2").hide();
  $("#sendForm1").show();
});

$("#sendPassword").on("input", function(){
  if ($("#sendPassword").val().length < 8) {
    $("#sendConfBtn").prop("disabled", true);
  }else{
    $("#sendConfBtn").prop("disabled", false);
  }
});

$("#sendConfBtn").click(function(){
    disableLoadBtn($("#sendConfBtn"));
    browser.runtime.sendMessage({command: 'sendTransaction', recipient: $("#sendRecipient").val(), amount: VirgoAPI.amountToAtomic($("#sendAmount").val()), password: $("#sendPassword").val()})
    .then(function (response) {
        enableLoadBtn($("#sendConfBtn"));
        if (response === false) {
            $("#sendInvalidPassword").show();
            $("#sendPassword").addClass("is-invalid");
            return;
        }
        $("#sendForm2").hide();
        $("#sendForm1").show();
        $("#sendPopup").hide();
    });
});



/**
 * Display base informations on popup
 */
browser.runtime.sendMessage({command: 'getBaseInfos'})
.then(function (response) {
  if (response.locked === true) {
    $("#unlockWalletBlock").show();
    $("#mainBlock").hide();
    return;
  }
  loadBaseInfos(response);
});

function loadBaseInfos(response){
  $("#walletAddress").val(response.address.address);
  
  if (response.showPasswordMsg){
    $("#setupPasswordPopup").css("display", "flex");
  }
  
  isWalletEncrypted = response.isEncrypted;
}

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

/**
 * Settings tab
 */
$("#settingsBtn").click(function(){
  
  if ($("#settingsPane").is(":hidden")){
    $("#settingsPane").show();
    $("#mainPane").hide();
  } else {
    $("#settingsPane").hide();
    $("#mainPane").show();
  }
  
});

var currentSettingsPage = 0;

$("#settingsReturnBtn").click(function() {
  
  if (currentSettingsPage == 0) {
    $("#settingsPane").hide();
    $("#mainPane").show();
    return;
  }
  
  if (currentSettingsPage == 1)
    $("#settingsTitle").html("Settings");
  
  $(".settings"+currentSettingsPage).hide();
  currentSettingsPage--;
  
});

$("#securitySettingsTab").click(function() {
  
  $("#securitySettings").show();
  $("#settingsTitle").html("Security");
  currentSettingsPage = 1;
  
});

$("#setPasswordTab").click(function() {
  
  $("#newPassword").val("");
  $("#newPasswordRepeat").val("");
  $("#newPasswordCurrent").val("");
  $("#setPasswordSettings").show();
  currentSettingsPage = 2;
  
});

$("#newPassword").on('input', function(){
  validateNewPasswordEntry();
});
$("#newPasswordRepeat").on('input', function(){
  validateNewPasswordEntry();
});

function validateNewPasswordEntry() {

    if ($("#newPassword").val().length < 8 || $("#newPasswordRepeat").val().length < 8)
      $("#newPasswordConfBtn").prop("disabled", true);
    else
      $("#newPasswordConfBtn").prop("disabled", false);
    
}

$("#newPassword").click(function(){
  resetNewPasswordErrors();
});
$("#newPasswordRepeat").click(function(){
  resetNewPasswordErrors();
});
$("#newPasswordCurrent").click(function(){
  resetNewPasswordErrors();
});

function resetNewPasswordErrors() {
    $("#newPassword").removeClass("is-invalid");
    $("#newPasswordRepeat").removeClass("is-invalid");
    $("#newPasswordCurrent").removeClass("is-invalid");
    $("#newPasswordInvalidCurrent").hide();
    $("#newPasswordNoMatch").hide();
}

$("#setPasswordPassBack").click(function(){
    $("#setPasswordPassForm").hide();
    $("#setPasswordMainForm").show();
});

$("#newPasswordConfBtn").click(function(){
  if ($("#newPassword").val() != $("#newPasswordRepeat").val()) {
    $("#newPassword").addClass("is-invalid");
    $("#newPasswordRepeat").addClass("is-invalid");
    $("#newPasswordNoMatch").show();
    return;
  }
  
  if (isWalletEncrypted) {
    $("#setPasswordPassForm").show();
    $("#setPasswordMainForm").hide();
    return;
  }
  
  browser.runtime.sendMessage({command: 'newPassword', newPassword: $("#newPassword").val(), password: $("#newPasswordCurrent").val()})
  .then(function (res) {
    
    if (!res) {//should not happen but let's still show an error
      $("#newPassword").addClass("is-invalid");
      $("#newPasswordRepeat").addClass("is-invalid");
      $("#newPasswordNoMatch").show();
      return;
    }
    
    $("#settingsReturnBtn").trigger("click");
    $("#settingsReturnBtn").trigger("click");
    $("#settingsReturnBtn").trigger("click");
  });
});

$("#newPasswordCurrent").on("input", function(){
  if ($("#newPasswordCurrent").val().length < 8)
    $("#newPasswordConfPwBtn").prop("disabled", true);
  else
    $("#newPasswordConfPwBtn").prop("disabled", false);
});

$("#newPasswordConfPwBtn").click(function(){
  browser.runtime.sendMessage({command: 'newPassword', newPassword: $("#newPassword").val(), password: $("#newPasswordCurrent").val()})
  .then(function (res) {
    
    if (!res) {
      $("#newPasswordCurrent").addClass("is-invalid");
      $("#newPasswordInvalidCurrent").show();
      return;
    }
    
    $("#setPasswordPassForm").hide();
    $("#setPasswordMainForm").show();
    $("#settingsReturnBtn").trigger("click");
    $("#settingsReturnBtn").trigger("click");
    $("#settingsReturnBtn").trigger("click");
  });
});

$("#setupPasswordPopupClose").click(function(){
  $("#setupPasswordPopup").hide();
  browser.runtime.sendMessage({command: 'hiddenPwMsg'});
});

$("#btnSetupPassword").click(function(){
  $("#settingsBtn").trigger("click");
  $("#securitySettingsTab").trigger("click");
  $("#setPasswordTab").trigger("click");
  $("#setupPasswordPopup").hide();
});


$("#networkSettingsTab").click(function() {
  
  $("#networkSettings").show();
  $("#settingsTitle").html("Network");
  currentSettingsPage = 1;
  
});

var providersString = "";

$("#changeProvidersTab").click(function() {
  
  $("#changeProvidersSettings").show();
  currentSettingsPage = 2;
  
  browser.runtime.sendMessage({command: "getProviders"})
    .then(function (res) {
      providersString = "";
      
      for (const provider of res)
        providersString = providersString + provider + "\n";
        
      $("#endpointsInput").val(providersString);
    });
});

$("#endpointsInput").on("input", function(){
  if ($("#endpointsInput").val().replaceAll("\n", "") == providersString.replaceAll("\n", "")) {
      $("#endpointsInput").removeClass("is-invalid");
      $("#changeProvidersInvalid").hide();
    $("#saveEndpointsBtn").prop("disabled", true);
    return;
  }
  
  let newProviders = $("#endpointsInput").val().split("\n");
  let checkDuplicate = {};
  
  for (let newProvider of newProviders){
    if (newProvider == "") continue;
    
    if (!validURL(newProvider)) {
      $("#endpointsInput").addClass("is-invalid");
      $("#changeProvidersInvalid").show();
      $("#saveEndpointsBtn").prop("disabled", true);
      return;
    }
    
    if (checkDuplicate[newProvider]) {
      $("#endpointsInput").addClass("is-invalid");
      $("#changeProvidersInvalid").show();
      $("#saveEndpointsBtn").prop("disabled", true);
      return;
    }else checkDuplicate[newProvider] = true;
  }
  
  $("#endpointsInput").removeClass("is-invalid");
  $("#changeProvidersInvalid").hide();
  $("#saveEndpointsBtn").prop("disabled", false);
});

$("#saveEndpointsBtn").click(function(){
  let newProviders = $("#endpointsInput").val().split("\n");
  let providers = [];
  for (const provider of newProviders) 
    if (validURL(provider)) 
      providers.push(provider);
  
  browser.runtime.sendMessage({"command": "setProviders", "providers": providers})
    .then(function (res) {
      $("#saveEndpointsBtn").prop("disabled", true);
      $("#settingsReturnBtn").trigger("click");
      $("#settingsReturnBtn").trigger("click");
      $("#settingsReturnBtn").trigger("click");
    });
});


$("#unlockPassword").on("input", function(){
  if ($("#unlockPassword").val().length >= 8)
    $("#unlockWalletBtn").prop("disabled", false);
  else
    $("#unlockWalletBtn").prop("disabled", true);
});

$("#unlockPassword").click(function(){
  $("#unlockPassword").removeClass("is-invalid");
  $("#unlockPasswordWrong").hide();
});

$("#unlockWalletBtn").click(function(){
  disableLoadBtn($("#unlockWalletBtn"));
  browser.runtime.sendMessage({command: 'unlock', password: $("#unlockPassword").val()})
  .then(function (resp) {
      enableLoadBtn($("#unlockWalletBtn"));
      if (!resp.locked) {
        loadBaseInfos(resp);
        $("#unlockWalletBlock").hide();
        $("#mainBlock").show();
        return;
      }
      $("#unlockPassword").addClass("is-invalid");
      $("#unlockPasswordWrong").show();
  });
});

function disableLoadBtn(elem) {
    elem.find("val").hide();
    elem.find("i").show();
    elem.attr("disabled", true);
}

function enableLoadBtn(elem) {
    elem.find("val").show();
    elem.find("i").hide();
    elem.attr("disabled", false);
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