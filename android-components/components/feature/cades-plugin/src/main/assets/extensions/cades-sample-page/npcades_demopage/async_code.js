function CertificateAdjuster()
{
}

function escapeHtml(unsafe)
{
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

CertificateAdjuster.prototype.checkQuotes = function(str)
{
    var result = 0, i = 0;
    for(i;i<str.length;i++)if(str[i]==='"')
        result++;
    return !(result%2);
}

function toggleBtnWrapper(func, btnId) {
    toggleBtn(btnId, false);
    var res = func();
    if (res && res.then) {
        res.then(function () {
            toggleBtn(btnId, true);
        }, function () {
            toggleBtn(btnId, true);
        });
    } else {
        toggleBtn(btnId, true);
    }
}

CertificateAdjuster.prototype.extract = function(from, what)
{
    var certName = "";

    var begin = from.indexOf(what);

    if(begin>=0)
    {
        var end = from.indexOf(', ', begin);
        while(end > 0) {
            if (this.checkQuotes(from.substr(begin, end-begin)))
                break;
            end = from.indexOf(', ', end + 1);
        }
        certName = (end < 0) ? from.substr(begin) : from.substr(begin, end - begin);
    }

    return certName;
}

CertificateAdjuster.prototype.Print2Digit = function(digit)
{
    return (digit<10) ? "0"+digit : digit;
}

CertificateAdjuster.prototype.GetCertDate = function(paramDate)
{
    var certDate = new Date(paramDate);
    return this.Print2Digit(certDate.getUTCDate())+"."+this.Print2Digit(certDate.getUTCMonth()+1)+"."+certDate.getFullYear() + " " +
             this.Print2Digit(certDate.getUTCHours()) + ":" + this.Print2Digit(certDate.getUTCMinutes()) + ":" + this.Print2Digit(certDate.getUTCSeconds());
}

CertificateAdjuster.prototype.GetCertName = function(certSubjectName)
{
    return this.extract(certSubjectName, 'CN=');
}

CertificateAdjuster.prototype.GetIssuer = function(certIssuerName)
{
    return this.extract(certIssuerName, 'CN=');
}

CertificateAdjuster.prototype.GetCertInfoString = function(certSubjectName, certFromDate)
{
    return this.extract(certSubjectName,'CN=') + "; Выдан: " + this.GetCertDate(certFromDate);
}

function CheckForPlugIn_Async() {
    function VersionCompare_Async(StringVersion, CurrentVersion)
    {
        // on error occurred suppose that current is actual
        var isActualVersion = true;

        if(typeof(CurrentVersion) === "string")
            return;

        var arr = StringVersion.split('.');
        var NewVersion = {
            MajorVersion: parseInt(arr[0]), 
            MinorVersion: parseInt(arr[1]), 
            BuildVersion: parseInt(arr[2])
        };
        cadesplugin.async_spawn(function *() {
            if(NewVersion.MajorVersion > (yield CurrentVersion.MajorVersion)) {
                isActualVersion = false;
            } else if(NewVersion.MinorVersion > (yield CurrentVersion.MinorVersion)) {
                isActualVersion = false;
            } else if(NewVersion.BuildVersion > (yield CurrentVersion.BuildVersion)) {
                isActualVersion = false;
            }

            if(!isActualVersion) {
                setStateForPlugin(Colors.UPDATE, "Плагин загружен, но есть более свежая версия.");
            }
            return;
        });
    }

    function CheckUpdateServer(CurrentPluginVersion, versionStruct) {
        var telemetryData = getTelemetryData(versionStruct.plugin, versionStruct.csp);
        var paramsArray = [];
        var params = "?";
        for (var property in telemetryData) {
            paramsArray.push(property + "=" + telemetryData[property].toLowerCase());
        }
        params += paramsArray.join('&');
        try {
            var xmlhttp = getXmlHttp();
            xmlhttp.onreadystatechange = function() {
                if (xmlhttp.readyState === 4) {
                    if(xmlhttp.status === 200) {
                        var jsonResponse = JSON.parse(xmlhttp.responseText);
                        var versions = jsonResponse.versions;
                        for (var i = 0; i < versions.length; i++) {
                            VersionCompare_Async(versions[i].version, CurrentPluginVersion);
                        }
                    }
                }
            }
            xmlhttp.open("GET", "https://api.cryptopro.ru/v1/cades/getState" + params, true);
            xmlhttp.send(null);
        }
        catch (exception) {
            // check version failed, nothing to do
        }
    }

    function ext_version_loaded_callback(ext_version) {
        document.getElementById('ExtVersionTxt').innerHTML = escapeHtml("Версия расширения: " + ext_version);
    }

    var extStore = "";
    function ext_id_loaded_callback(ext_id) {
        var OperaStoreExtId = "epebfcehmdedogndhlcacafjaacknbcm";
        var ChromeStoreExtId = "iifchhfnnmpdbibifmljnfjhpififfog";
        if (extStore !== "")
            extStore += ", ";
        if (ext_id === OperaStoreExtId)
            extStore += "Opera Store";
        else if (ext_id === ChromeStoreExtId)
            extStore += "Chrome Store";
        document.getElementById('ExtStoreTxt').innerHTML = escapeHtml("Магазин расширений: " + extStore);
    }

    var versionStruct = {csp: null, os: null, plugin: null, uuid: null};
    setStateForCSP(Colors.INFO, "КриптоПро CSP не загружен");
    cadesplugin.async_spawn(function *() {
        var oAbout = yield cadesplugin.CreateObjectAsync("CAdESCOM.About");
        cadesplugin.get_extension_version(ext_version_loaded_callback);
        cadesplugin.get_extension_id(ext_id_loaded_callback);
        var CurrentPluginVersion = yield oAbout.PluginVersion;
        versionStruct.plugin = yield CurrentPluginVersion.toString();
        document.getElementById('PlugInVersionTxt').innerHTML = escapeHtml("Версия плагина: " + (versionStruct.plugin));
        setStateForPlugin(Colors.SUCCESS, "Плагин загружен");
        var ver = yield oAbout.CSPVersion("", 80);
        versionStruct.csp = (yield ver.MajorVersion) + "." + (yield ver.MinorVersion) + "." + (yield ver.BuildVersion);
        document.getElementById('CSPVersionTxt').innerHTML = escapeHtml("Версия криптопровайдера: " + versionStruct.csp);
        try {
            var sCSPName = yield oAbout.CSPName(80);
            setStateForCSP(Colors.SUCCESS, "Криптопровайдер загружен");
            document.getElementById('CSPNameTxt').innerHTML = escapeHtml("Криптопровайдер: " + sCSPName);
        }
        catch (err) { }
        try {
            var oLicense = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPLicense");
            var cspValidTo = escapeHtml(yield oLicense.ValidTo());
            var tspValidTo = escapeHtml(yield oLicense.ValidTo(cadesplugin.CADESCOM_PRODUCT_TSP));
            var ocspValidTo = escapeHtml(yield oLicense.ValidTo(cadesplugin.CADESCOM_PRODUCT_OCSP));
            try {
                if (!(yield oLicense.IsValid(cadesplugin.CADESCOM_PRODUCT_CSP))) {
                    cspValidTo = addLicensePrompt(cadesplugin.CADESCOM_PRODUCT_CSP, cspValidTo);
                }
                if (!(yield oLicense.IsValid(cadesplugin.CADESCOM_PRODUCT_TSP))) {
                    tspValidTo = addLicensePrompt(cadesplugin.CADESCOM_PRODUCT_TSP, tspValidTo);
                }
                if (!(yield oLicense.IsValid(cadesplugin.CADESCOM_PRODUCT_OCSP))) {
                    ocspValidTo = addLicensePrompt(cadesplugin.CADESCOM_PRODUCT_OCSP, ocspValidTo);
                }
            }
            catch (err) { }
            cspValidTo += "<br/>\tДата первой установки: " +
                (yield oLicense.FirstInstallDate(cadesplugin.CADESCOM_PRODUCT_CSP));
            cspValidTo += "<br/>\tТип лицензии: " +
                (yield oLicense.Type(cadesplugin.CADESCOM_PRODUCT_CSP));
            tspValidTo += "<br/>\tДата первой установки: " +
                (yield oLicense.FirstInstallDate(cadesplugin.CADESCOM_PRODUCT_TSP));
            tspValidTo += "<br/>\tТип лицензии: " +
                (yield oLicense.Type(cadesplugin.CADESCOM_PRODUCT_TSP));
            ocspValidTo += "<br/>\tДата первой установки: " +
                (yield oLicense.FirstInstallDate(cadesplugin.CADESCOM_PRODUCT_OCSP));
            ocspValidTo += "<br/>\tТип лицензии: " +
                (yield oLicense.Type(cadesplugin.CADESCOM_PRODUCT_OCSP));

            document.getElementById('CspLicense').innerHTML = "Лицензия CSP: " + cspValidTo;
            if (bShowTspLicenseInfo) {
                document.getElementById('TspLicense').innerHTML = "Лицензия TSP: " + tspValidTo;
            }
            if (bShowOcspLicenseInfo) {
                document.getElementById('OcspLicense').innerHTML = "Лицензия OCSP: " + ocspValidTo;
            }
        }
        catch (err) { }
        CheckUpdateServer(CurrentPluginVersion, versionStruct);
        if (location.pathname.indexOf("symalgo_sample.html")>=0) {
            FillCertList_Async('CertListBox1', 'CertListBox2');
         }else if (location.pathname.indexOf("cades_root_export.html")>=0) {
            FillCertList_Async('CertListBox', undefined, true);
        } else if (location.pathname.indexOf("verify.html") >= 0) {
            return;
        } else {
            FillCertList_Async('CertListBox');
        }
    }); //cadesplugin.async_spawn
}

function applyOnClick() {
    var apply = document.getElementById("applyBtn");
    apply.disabled = true;
    cadesplugin.async_spawn(function* (args) {
        try {
            var oLicense = yield cadesplugin.CreateObjectAsync("cadescom.cplicense");
            var serialNumber = document.getElementById("modalInfoSerial").value;
            var user = document.getElementById("modalInfoUser").value;
            var company = document.getElementById("modalInfoCompany").value;
            yield oLicense.SetLicense(serialNumber, user, company);
            document.getElementById("modalSuccess").style.display = "";
            document.getElementById("modalError").style.display = "none";
            closePopup = function () { window.location.reload(); }
        }
        catch (err) {
            var modalError = document.getElementById("modalError");
            modalError.innerHTML = cadesplugin.getLastError(err);
            modalError.style.display = "";
        }
        apply.disabled = false;
    }, event.target);//cadesplugin.async_spawn
}

function onCertificateSelected(event) {
    cadesplugin.async_spawn(function *(args) {
        var selectedCertID = args[0][args[0].selectedIndex].value;
        var certificate = global_selectbox_container[selectedCertID];
        FillCertInfo_Async(certificate, event.target.boxId, global_isFromCont[selectedCertID]);
    }, event.target);//cadesplugin.async_spawn
}

function FillCertList_Async(lstId, lstId2, rootStore, selectedIndex) {
    cadesplugin.async_spawn(function *() {
        setStateForObjects(Colors.INFO, "Идет перечисление объектов плагина");
        var MyStoreExists = true;
        try {
            var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
            if (!oStore) {
                alert("Create store failed");
                setStateForObjects(Colors.FAIL, "Ошибка при перечислении объектов плагина");
                return;
            }
            if (rootStore) {
                yield oStore.Open(
                    cadesplugin.CADESCOM_CURRENT_USER_STORE,
                    "Root",
                    cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
                );
            } else yield oStore.Open()
        }
        catch (ex) {
            MyStoreExists = false;
        }

        var lst = document.getElementById(lstId);
        if(!lst)
        {
            setStateForObjects(Colors.FAIL, "Ошибка при перечислении объектов плагина");
            return;
        }
        lst.onchange = onCertificateSelected;
        lst.boxId = lstId;

        // второй список опционален
        var lst2 = document.getElementById(lstId2);
        if(lst2)
        {
            lst2.onchange = onCertificateSelected;
            lst2.boxId = lstId2;
        }

        if (MyStoreExists) {
            try {
                var certs = yield oStore.Certificates;
                var certCnt = yield certs.Count;
            }
            catch (ex) {
                alert("Ошибка при получении Certificates или Count: " + cadesplugin.getLastError(ex));
                setStateForObjects(Colors.FAIL, "Ошибка при перечислении объектов плагина");
                return;
            }
            for (var i = 1; i <= certCnt; i++) {
                try {
                    var cert = yield certs.Item(i);
                }
                catch (ex) {
                    alert("Ошибка при перечислении сертификатов: " + cadesplugin.getLastError(ex));
                    setStateForObjects(Colors.FAIL, "Ошибка при перечислении объектов плагина");
                    return;
                }

                try {
                    var certThumbprint = yield cert.Thumbprint;
                    var foundIndex = global_selectbox_container_thumbprint.indexOf(certThumbprint);
                    if (foundIndex > -1) {
                        continue;
                    }
                    var oOpt = document.createElement("OPTION");
                    try {
                        var ValidFromDate = new Date((yield cert.ValidFromDate));
                        var ValidToDate = new Date(yield cert.ValidToDate);
                        var IsValid = ValidToDate > Date.now();
                        var emoji = CertStatusEmoji(IsValid);
                        oOpt.text = emoji + new CertificateAdjuster().GetCertInfoString(yield cert.SubjectName, ValidFromDate);
                    }
                    catch (ex) {
                        alert("Ошибка при получении свойства SubjectName: " + cadesplugin.getLastError(ex));
                    }
                    oOpt.value = global_selectbox_counter;
                    lst.options.add(oOpt);
                    if (lst2) {
                        var oOpt2 = document.createElement("OPTION");
                        oOpt2.text = oOpt.text;
                        oOpt2.value = oOpt.value;
                        lst2.options.add(oOpt2);
                    }
                    global_selectbox_container.push(cert);
                    global_selectbox_container_thumbprint.push(certThumbprint);
                    global_isFromCont.push(false);
                    global_selectbox_counter++;
                }
                catch (ex) {
                    alert("Ошибка при получении свойства Thumbprint: " + cadesplugin.getLastError(ex));
                }
            }
            yield oStore.Close();
        }

        if (rootStore) {
            setStateForObjects(Colors.SUCCESS, "Перечисление объектов плагина завершено");
            return
        }

        //В версии плагина 2.0.13292+ есть возможность получить сертификаты из 
        //закрытых ключей и не установленных в хранилище
        try {
            yield oStore.Open(cadesplugin.CADESCOM_CONTAINER_STORE);
            try {
                var certs = yield oStore.Certificates;
                var certCnt = yield certs.Count;
            }
            catch (ex) {
                alert("Ошибка при получении Certificates или Count: " + cadesplugin.getLastError(ex));
                setStateForObjects(Colors.FAIL, "Ошибка при перечислении объектов плагина");
                return;
            }
            for (var i = 1; i <= certCnt; i++) {
                try {
                    var cert = yield certs.Item(i);
                }
                catch (ex) {
                    alert("Ошибка при перечислении сертификатов: " + cadesplugin.getLastError(ex));
                    setStateForObjects(Colors.FAIL, "Ошибка при перечислении объектов плагина");
                    return;
                }

                try {
                    var certThumbprint = yield cert.Thumbprint;
                    var foundIndex = global_selectbox_container_thumbprint.indexOf(certThumbprint);
                    if (foundIndex > -1) {
                        continue;
                    }
                    var oOpt = document.createElement("OPTION");
                    try {
                        var ValidFromDate = new Date((yield cert.ValidFromDate));
                        var ValidToDate = new Date(yield cert.ValidToDate);
                        var IsValid = ValidToDate > Date.now();
                        var emoji = CertStatusEmoji(IsValid);
                        oOpt.text = emoji + new CertificateAdjuster().GetCertInfoString(yield cert.SubjectName, ValidFromDate);
                    }
                    catch (ex) {
                        alert("Ошибка при получении свойства SubjectName: " + cadesplugin.getLastError(ex));
                    }
                    oOpt.value = global_selectbox_counter;
                    lst.options.add(oOpt);
                    if (lst2) {
                        var oOpt2 = document.createElement("OPTION");
                        oOpt2.text = oOpt.text;
                        oOpt2.value = oOpt.value;
                        lst2.options.add(oOpt2);
                    }
                    global_selectbox_container.push(cert);
                    global_selectbox_container_thumbprint.push(certThumbprint);
                    global_isFromCont.push(true);
                    global_selectbox_counter++;
                }
                catch (ex) {
                    alert("Ошибка при получении свойства Thumbprint: " + cadesplugin.getLastError(ex));
                }
            }
            yield oStore.Close();

        }
        catch (ex) {
        }
        if(global_selectbox_container.length == 0) {
            document.getElementById("boxdiv").style.display = 'flex';
        }
        if (selectedIndex != -1 && selectedIndex || selectedIndex === 0) {
            document.getElementById(lstId).selectedIndex = selectedIndex;
            var certificate = global_selectbox_container[selectedIndex];
            FillCertInfo_Async(certificate);
        }
        setStateForObjects(Colors.SUCCESS, "Перечисление объектов плагина завершено");
    });//cadesplugin.async_spawn
}

function CreateSimpleSign_Async() {
    cadesplugin.async_spawn(function*(arg) {
        try {
            var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
            yield oStore.Open();
        } catch (err) {
            alert('Certificate not found');
            return;
        }
        var all_certs = yield oStore.Certificates;

        if ((yield all_certs.Count) == 0) {
            document.getElementById("boxdiv").style.display = 'flex';
            return;
        }

        var cert;
        var found = 0;
        for (var i = 1; i <= (yield all_certs.Count); i++) {
            try {
                cert = yield all_certs.Item(i);
            }
            catch (ex) {
                alert("Ошибка при перечислении сертификатов: " + cadesplugin.getLastError(ex));
                return;
            }

            var dateObj = new Date();
            try {
                var certDate = new Date((yield cert.ValidToDate));
                var Validator = yield cert.IsValid();
                var IsValid = yield Validator.Result;
                if(dateObj< certDate && (yield cert.HasPrivateKey()) && IsValid) {
                    found = 1;
                    break;
                }
                else {
                    continue;
                }
            }
            catch (ex) {
                alert("Ошибка при получении свойства SubjectName: " + cadesplugin.getLastError(ex));
            }
        }

        if (found == 0) {
            document.getElementById("boxdiv").style.display = 'flex';
            return;
        }

        var dataToSign = document.getElementById("DataToSignTxtBox").value;
        var SignatureFieldTitle = document.getElementsByName("SignatureTitle");
        var Signature;
        try
        {
            FillCertInfo_Async(cert);
            var errormes = "";
            try {
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
            } catch (err) {
                errormes = "Failed to create CAdESCOM.CPSigner: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            if (oSigner) {
                yield oSigner.propset_Certificate(cert);
            }
            else {
                errormes = "Failed to create CAdESCOM.CPSigner";
                throw errormes;
            }

            var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
            var CADES_BES = 1;

            if (dataToSign) {
                // Данные на подпись ввели
                yield oSignedData.propset_Content(dataToSign);
            }
            yield oSigner.propset_Options(cadesplugin.CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY); 
            try {
                Signature = yield oSignedData.SignCades(oSigner, CADES_BES);
            }
            catch (err) {
                errormes = "Не удалось создать подпись из-за ошибки: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(Signature);
            SignatureFieldTitle[0].innerHTML = "Подпись сформирована успешно:";
        }
        catch(err)
        {
            SignatureFieldTitle[0].innerHTML = "Возникла ошибка:";
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(cadesplugin.getLastError(err));
        }
    }); //cadesplugin.async_spawn
}


function SignCadesBES_Async(certListBoxId, data, setDisplayData) {
    return cadesplugin.async_spawn(function*(arg) {
        var e = document.getElementById(arg[0]);
        var selectedCertID = e.selectedIndex;
        if (selectedCertID == -1) {
            selectedCertID = 0;
        }

        var certificate = global_selectbox_container[selectedCertID];

        var dataToSign = document.getElementById("DataToSignTxtBox").value;
        if(typeof(data) != 'undefined')
        {
            dataToSign = Base64.encode(data);
        }else {
            dataToSign = Base64.encode(dataToSign);
        }
        var SignatureFieldTitle = document.getElementsByName("SignatureTitle");
        var Signature;
        try
        {
            //FillCertInfo_Async(certificate);
            var errormes = "";
            try {
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
            } catch (err) {
                errormes = "Failed to create CAdESCOM.CPSigner: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            var oSigningTimeAttr = yield cadesplugin.CreateObjectAsync("CADESCOM.CPAttribute");

            yield oSigningTimeAttr.propset_Name(cadesplugin.CAPICOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME);
            var oTimeNow = new Date();
            yield oSigningTimeAttr.propset_Value(oTimeNow);
            var attr = yield oSigner.AuthenticatedAttributes2;
            yield attr.Add(oSigningTimeAttr);


            var oDocumentNameAttr = yield cadesplugin.CreateObjectAsync("CADESCOM.CPAttribute");
            yield oDocumentNameAttr.propset_Name(cadesplugin.CADESCOM_AUTHENTICATED_ATTRIBUTE_DOCUMENT_NAME);
            yield oDocumentNameAttr.propset_Value("Document Name");
            yield attr.Add(oDocumentNameAttr);

            if (oSigner) {
                yield oSigner.propset_Certificate(certificate);
            }
            else {
                errormes = "Failed to create CAdESCOM.CPSigner";
                throw errormes;
            }

            var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
            if (dataToSign) {
                // Данные на подпись ввели
                yield oSignedData.propset_ContentEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY); //
                yield oSignedData.propset_Content(dataToSign);
            }
            yield oSigner.propset_Options(cadesplugin.CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY);
            if (typeof (setDisplayData) != 'undefined') {
                //Set display data flag flag for devices like Rutoken PinPad
                yield oSignedData.propset_DisplayData(1);
            }

            try {
                Signature = yield oSignedData.SignCades(oSigner, cadesplugin.CADESCOM_CADES_BES);
            }
            catch (err) {
                errormes = "Не удалось создать подпись из-за ошибки: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(Signature);
            SignatureFieldTitle[0].innerHTML = "Подпись сформирована успешно:";
        }
        catch(err)
        {
            SignatureFieldTitle[0].innerHTML = "Возникла ошибка:";
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(cadesplugin.getLastError(err));
        }
    }, certListBoxId); //cadesplugin.async_spawn
}

function SignCadesBES_Async_File(certListBoxId) {
    return cadesplugin.async_spawn(function*(arg) {
        var e = document.getElementById(arg[0]);
        var selectedCertID = e.selectedIndex;
        if (selectedCertID == -1) {
            selectedCertID = 0;
        }
        var certificate = global_selectbox_container[selectedCertID];
        var SignatureFieldTitle = document.getElementsByName("SignatureTitle");
        var Signature;
        try
        {
            //FillCertInfo_Async(certificate);
            var errormes = "";
            try {
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
            } catch (err) {
                errormes = "Failed to create CAdESCOM.CPSigner: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            var oSigningTimeAttr = yield cadesplugin.CreateObjectAsync("CADESCOM.CPAttribute");

            var CAPICOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME = 0;
            yield oSigningTimeAttr.propset_Name(CAPICOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME);
            var oTimeNow = new Date();
            yield oSigningTimeAttr.propset_Value(oTimeNow);
            var attr = yield oSigner.AuthenticatedAttributes2;
            yield attr.Add(oSigningTimeAttr);


            var oDocumentNameAttr = yield cadesplugin.CreateObjectAsync("CADESCOM.CPAttribute");
            var CADESCOM_AUTHENTICATED_ATTRIBUTE_DOCUMENT_NAME = 1;
            yield oDocumentNameAttr.propset_Name(CADESCOM_AUTHENTICATED_ATTRIBUTE_DOCUMENT_NAME);
            yield oDocumentNameAttr.propset_Value("Document Name");
            yield attr.Add(oDocumentNameAttr);

            if (oSigner) {
                yield oSigner.propset_Certificate(certificate);
            }
            else {
                errormes = "Failed to create CAdESCOM.CPSigner";
                throw errormes;
            }

            var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
            var CADES_BES = 1;

            var dataToSign = fileContent; // fileContent - объявлен в Code.js
            if (dataToSign) {
                // Данные на подпись ввели
                yield oSignedData.propset_ContentEncoding(1); //CADESCOM_BASE64_TO_BINARY
                yield oSignedData.propset_Content(dataToSign);
            }
            yield oSigner.propset_Options(cadesplugin.CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY);
            try {
                var StartTime = Date.now();
                Signature = yield oSignedData.SignCades(oSigner, CADES_BES);
                var EndTime = Date.now();
                document.getElementsByName('TimeTitle')[0].innerHTML = "Время выполнения: " + (EndTime - StartTime) + " мс";
            }
            catch (err) {
                errormes = "Не удалось создать подпись из-за ошибки: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(Signature);
            SignatureFieldTitle[0].innerHTML = "Подпись сформирована успешно:";
        }
        catch(err)
        {
            SignatureFieldTitle[0].innerHTML = "Возникла ошибка:";
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(cadesplugin.getLastError(err));
        }
    }, certListBoxId); //cadesplugin.async_spawn
    }

function SignCadesEnhanced_Async(certListBoxId, sign_type) {
    return cadesplugin.async_spawn(function*(arg) {
        var e = document.getElementById(arg[0]);
        var selectedCertID = e.selectedIndex;
        if (selectedCertID == -1) {
            selectedCertID = 0;
        }
        var certificate = global_selectbox_container[selectedCertID];

        var dataToSign = document.getElementById("DataToSignTxtBox").value;
        var SignatureFieldTitle = document.getElementsByName("SignatureTitle");
        var Signature;
        try
        {
            //FillCertInfo_Async(certificate);
            var errormes = "";
            try {
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
            } catch (err) {
                errormes = "Failed to create CAdESCOM.CPSigner: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            if (oSigner) {
                yield oSigner.propset_Certificate(certificate);
            }
            else {
                errormes = "Failed to create CAdESCOM.CPSigner";
                throw errormes;
            }

            var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
            var tspService = document.getElementById("TSPServiceTxtBox").value ;

            if (dataToSign) {
                // Данные на подпись ввели
                yield oSignedData.propset_Content(dataToSign);
                yield oSigner.propset_Options(1); //CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN
            }
            yield oSigner.propset_TSAAddress(tspService);
            try {
                Signature = yield oSignedData.SignCades(oSigner, sign_type);
            }
            catch (err) {
                errormes = "Не удалось создать подпись из-за ошибки: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(Signature);
            SignatureFieldTitle[0].innerHTML = "Подпись сформирована успешно:";
        }
        catch(err)
        {
            SignatureFieldTitle[0].innerHTML = "Возникла ошибка:";
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(cadesplugin.getLastError(err));
        }
    }, certListBoxId); //cadesplugin.async_spawn
}

function SignCadesXML_Async(certListBoxId, signatureType) {
    return cadesplugin.async_spawn(function*(arg) {
        var e = document.getElementById(arg[0]);
        var selectedCertID = e.selectedIndex;
        if (selectedCertID == -1) {
            selectedCertID = 0;
        }

        var certificate = global_selectbox_container[selectedCertID];

        var dataToSign = document.getElementById("DataToSignTxtBox").value;
        var SignatureFieldTitle = document.getElementsByName("SignatureTitle");
        var Signature;
        try
        {
            //FillCertInfo_Async(certificate);
            var errormes = "";
            try {
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
            } catch (err) {
                errormes = "Failed to create CAdESCOM.CPSigner: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            if (oSigner) {
                yield oSigner.propset_Certificate(certificate);
            }
            else {
                errormes = "Failed to create CAdESCOM.CPSigner";
                throw errormes;
            }

            try {
                var oSignedXML = yield cadesplugin.CreateObjectAsync("CAdESCOM.SignedXML");
            } catch (err) {
                errormes = "Failed to create CAdESCOM.SignedXML: " + cadesplugin.getLastError(err);
                throw errormes;
            }

            var signMethod = "";
            var digestMethod = "";

            var pubKey = yield certificate.PublicKey();
            var algo = yield pubKey.Algorithm;
            var algoOid = yield algo.Value;
            if (algoOid == "1.2.643.7.1.1.1.1") {   // алгоритм подписи ГОСТ Р 34.10-2012 с ключом 256 бит
                signMethod = "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256";
                digestMethod = "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-256";
            }
            else if (algoOid == "1.2.643.7.1.1.1.2") {   // алгоритм подписи ГОСТ Р 34.10-2012 с ключом 512 бит
                signMethod = "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-512";
                digestMethod = "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-512";
            }
            else if (algoOid == "1.2.643.2.2.19") {  // алгоритм ГОСТ Р 34.10-2001
                signMethod = "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102001-gostr3411";
                digestMethod = "urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr3411";
            }
            else {
                errormes = "Данная демо страница поддерживает XML подпись сертификатами с алгоритмом ГОСТ Р 34.10-2012, ГОСТ Р 34.10-2001";
                throw errormes;
            }
            
            var CADESCOM_XML_SIGNATURE_TYPE_ENVELOPED = 0|arg[1]; //arg[1] = signatureType
            if (arg[1] > cadesplugin.CADESCOM_XADES_BES ) {
                var tspService = document.getElementById("TSPServiceTxtBox").value ;
                yield oSigner.propset_TSAAddress(tspService);
            }
            if (dataToSign) {
                // Данные на подпись ввели
                yield oSignedXML.propset_Content(dataToSign);
            }
            yield oSignedXML.propset_SignatureType(CADESCOM_XML_SIGNATURE_TYPE_ENVELOPED);
            yield oSignedXML.propset_SignatureMethod(signMethod);
            yield oSignedXML.propset_DigestMethod(digestMethod);

            try {
                Signature = yield oSignedXML.Sign(oSigner);
            }
            catch (err) {
                errormes = "Не удалось создать подпись из-за ошибки: " + cadesplugin.getLastError(err);
                throw errormes;
            }
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(Signature);
            SignatureFieldTitle[0].innerHTML = "Подпись сформирована успешно:";
        }
        catch(err)
        {
            SignatureFieldTitle[0].innerHTML = "Возникла ошибка:";
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(cadesplugin.getLastError(err));
        }
    }, certListBoxId, signatureType); //cadesplugin.async_spawn
}

function FillCertInfo_Async(certificate, certBoxId, isFromContainer)
{
    var BoxId;
    var field_prefix;
    if(typeof(certBoxId) == 'undefined' || certBoxId == "CertListBox")
    {
        BoxId = 'cert_info';
        field_prefix = '';
    }else if (certBoxId == "CertListBox1") {
        BoxId = 'cert_info1';
        field_prefix = 'cert_info1';
    } else if (certBoxId == "CertListBox2") {
        BoxId = 'cert_info2';
        field_prefix = 'cert_info2';
    } else {
        BoxId = certBoxId;
        field_prefix = certBoxId;
    }
    cadesplugin.async_spawn (function*(args) {
        ClearCertInfo(field_prefix);
        var Adjust = new CertificateAdjuster();

        document.getElementById(args[1]).style.display = '';
        document.getElementById(args[2] + "subject").innerHTML = "Владелец: <b>" + escapeHtml(Adjust.GetCertName(yield args[0].SubjectName)) + "<b>";
        document.getElementById(args[2] + "issuer").innerHTML = "Издатель: <b>" + escapeHtml(Adjust.GetIssuer(yield args[0].IssuerName)) + "<b>";

        var ValidToDate = new Date((yield args[0].ValidToDate));
        var ValidFromDate = new Date((yield args[0].ValidFromDate));

        document.getElementById(args[2] + "from").innerHTML = "Выдан: <b>" + escapeHtml(Adjust.GetCertDate(ValidFromDate)) + " UTC<b>";
        document.getElementById(args[2] + "till").innerHTML = "Действителен до: <b>" + escapeHtml(Adjust.GetCertDate(ValidToDate)) + " UTC<b>";

        var hasPrivateKey = yield args[0].HasPrivateKey();
        var Now = new Date();

        var pubKey = yield args[0].PublicKey();
        var algo = yield pubKey.Algorithm;
        var fAlgoName = yield algo.FriendlyName;

        var isRootExport = location.pathname.indexOf("cades_root_export.html") >= 0

        document.getElementById(args[2] + "algorithm").innerHTML = "Алгоритм ключа: <b>" + escapeHtml(fAlgoName) + "<b>";
        if (hasPrivateKey) {
            var oPrivateKey = yield args[0].PrivateKey;
            var sProviderName = yield oPrivateKey.ProviderName;
            document.getElementById(args[2] + "provname").innerHTML = "Криптопровайдер: <b>" + escapeHtml(sProviderName) + "<b>";
            try {
                var sPrivateKeyLink = yield oPrivateKey.UniqueContainerName;
                document.getElementById(args[2] + "privateKeyLink").innerHTML = "Ссылка на закрытый ключ: <b>" + escapeHtml(sPrivateKeyLink) + "<b>";
            } catch (e) {
                document.getElementById(args[2] + "privateKeyLink").innerHTML = "Ссылка на закрытый ключ: <b>" + escapeHtml(cadesplugin.getLastError(e)) + "<b>";
            }
        } else if (!isRootExport) {
            document.getElementById(args[2] + "provname").innerHTML = "Криптопровайдер:<b>";
            document.getElementById(args[2] + "privateKeyLink").innerHTML = "Ссылка на закрытый ключ:<b>";
        }
        var certIsValid = false;
        if(Now < ValidFromDate) {
            document.getElementById(args[2] + "status").innerHTML = "Статус: <b class=\"error\">Срок действия не наступил</b>";
        } else if( Now > ValidToDate){
            document.getElementById(args[2] + "status").innerHTML = "Статус: <b class=\"error\">Срок действия истек</b>";
        } else if( !hasPrivateKey ){
            if (isRootExport) {
                document.getElementById(args[2] + "status").innerHTML = "Статус: <b>Нет привязки к закрытому ключу</b>";
            } else {
            document.getElementById(args[2] + "status").innerHTML = "Статус: <b class=\"error\">Нет привязки к закрытому ключу</b>";
            }
        } else {
            //если попадется сертификат с неизвестным алгоритмом
            //тут будет исключение. В таком сертификате просто пропускаем такое поле
            try {
                var Validator = yield args[0].IsValid();
                certIsValid = yield Validator.Result;
            } catch(e) {
                certIsValid = false;
            }
            if(certIsValid){
                document.getElementById(args[2] + "status").innerHTML = "Статус: <b> Действителен<b>";
            } else {
                var isValidInfo = "";
                try { 
                    isValidInfo = "Статус: <b class=\"error\">Не действителен</b><br/>";
                    isValidInfo += "Цепочка для сертификата:"
                    var oChainCerts = yield Validator.ValidationCertificates;
                    var oErrorStatuses = yield Validator.ErrorStatuses;
                    var chainCount = yield oChainCerts.Count;
                    for (j = 1; j <= chainCount; j++) {
                        var oChainCert = yield oChainCerts.Item(j);
                        var chainSN = escapeHtml(Adjust.GetCertName(yield oChainCert.SubjectName));
                        var status = yield oErrorStatuses.Item(chainCount - j + 1);
                        sStatus = "";
                        if (status) {
                            sStatus = " <b class=\"error\">";
                            if (status & cadesplugin.CERT_TRUST_IS_NOT_TIME_VALID) sStatus += "Истек/не наступил срок действия сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_IS_REVOKED) sStatus += "Сертификат отозван; ";
                            if (status & cadesplugin.CERT_TRUST_IS_NOT_SIGNATURE_VALID) sStatus += "Сертификат не имеет действительной подписи; ";
                            if (status & cadesplugin.CERT_TRUST_IS_NOT_VALID_FOR_USAGE) sStatus += "Сертификат не предназначен для такого использования; ";
                            if (status & cadesplugin.CERT_TRUST_IS_UNTRUSTED_ROOT) sStatus += "Нет доверия к корневому сертификату; ";
                            if (status & cadesplugin.CERT_TRUST_REVOCATION_STATUS_UNKNOWN) sStatus += "Статус сертификата неизвестен; ";
                            if (status & cadesplugin.CERT_TRUST_IS_CYCLIC) sStatus += "Кольцевая зависимость для издателей сертификатов; ";
                            if (status & cadesplugin.CERT_TRUST_INVALID_EXTENSION) sStatus += "Одно из расширений сертификата недействительно; ";
                            if (status & cadesplugin.CERT_TRUST_INVALID_POLICY_CONSTRAINTS) sStatus += "Некорректные ограничения для сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_INVALID_BASIC_CONSTRAINTS) sStatus += "Некорректные ограничения для сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_INVALID_NAME_CONSTRAINTS) sStatus += "Некорректные ограничения для сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_HAS_NOT_SUPPORTED_NAME_CONSTRAINT) sStatus += "Некорректные ограничения для сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_HAS_NOT_DEFINED_NAME_CONSTRAINT) sStatus += "Некорректные ограничения для сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_HAS_NOT_PERMITTED_NAME_CONSTRAINT) sStatus += "Некорректные ограничения для сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_HAS_EXCLUDED_NAME_CONSTRAINT) sStatus += "Некорректные ограничения для сертификата; ";
                            if (status & cadesplugin.CERT_TRUST_IS_OFFLINE_REVOCATION) sStatus += "Статус сертификата на отзыв либо устарел, либо проверка производится оффлайн; ";
                            if (status & cadesplugin.CERT_TRUST_NO_ISSUANCE_CHAIN_POLICY) sStatus += "Конечный сертификат не имеет результирующей политики выдачи, а один из сертификатов выдающего центра сертификации имеет расширение ограничений политики, требующее этого; ";
                            if (status & cadesplugin.CERT_TRUST_IS_EXPLICIT_DISTRUST) sStatus += "Явное недоверие к сертификату ";
                            if (status & cadesplugin.CERT_TRUST_HAS_NOT_SUPPORTED_CRITICAL_EXT) sStatus += "Сертификат не поддерживает критическое расширение; ";
                            if (status & cadesplugin.CERT_TRUST_HAS_WEAK_SIGNATURE) sStatus += "При подписи сертификата использован недостаточно стойкий алгоритм; ";
                            if (sStatus) {
                                sStatus = sStatus.substring(0, sStatus.length - 2);
                            }
                            sStatus += "</b> ";
                        }
                    isValidInfo += "<br/>• <b>" + chainSN + "</b>" + sStatus;
                    }
                }
                catch (e) {
                    isValidInfo = "Статус: <b class=\"error\">Ошибка при проверке цепочки сертификатов. Возможно, на компьютере не установлены сертификаты УЦ, выдавшего ваш сертификат</b>";
                }
                document.getElementById(args[2] + "status").innerHTML = isValidInfo;
            }
            try {
                var oExts = yield args[0].Extensions();
                var extCount = yield oExts.Count;
                for (i = 1; i <= extCount; i++) {
                    var oExt = yield oExts.Item(i);
                    var oOID = yield oExt.OID;
                    var oidValue = yield oOID.Value;
                    if (oidValue == "1.2.643.2.2.49.2") {
                        document.getElementById(args[2] + "certlicense").innerHTML = "Лицензия CSP в сертификате: <b>Да</b>";
                        break;
                    }
                }
            }
            catch (e) { }
        }

        if(args[3])
        {
            if (certIsValid) {
                document.getElementById(field_prefix + "location").innerHTML = "Установлен в хранилище: <span><b class=\"warning\">Нет. При такой конфигурации не все приложения и порталы могут работать</b><br/><a style=\"cursor: pointer\" onclick=\"Common_InstallCertificate('"+ escapeHtml(certBoxId) +"');\">Установить</a></span>";
            } else {
                document.getElementById(field_prefix + "location").innerHTML = "Установлен в хранилище: <b>Нет</b>";
            }
        } else {
            document.getElementById(field_prefix + "location").innerHTML = "Установлен в хранилище: <b>Да</b>";
        }
        if ((window.innerHeight + Math.round(window.scrollY)) >= document.body.offsetHeight) {
            var footer = document.getElementById('footer')
            if (footer) {
                var h = footer.offsetHeight;
                window.scrollBy(0, -1 * h);
            }
        }
    }, certificate, BoxId, field_prefix, isFromContainer);//cadesplugin.async_spawn
}

function Encrypt_Async() {
    return cadesplugin.async_spawn (function*() {
        document.getElementById("DataEncryptedIV1").innerHTML = "";
        document.getElementById("DataEncryptedIV2").innerHTML = "";
        document.getElementById("DataEncryptedDiversData1").innerHTML = "";
        document.getElementById("DataEncryptedDiversData2").innerHTML = "";
        document.getElementById("DataEncryptedBox1").innerHTML = "";
        document.getElementById("DataEncryptedBox2").innerHTML = "";
        document.getElementById("DataEncryptedKey1").innerHTML = "";
        document.getElementById("DataEncryptedKey2").innerHTML = "";
        document.getElementById("DataDecryptedBox1").innerHTML = "";
        document.getElementById("DataDecryptedBox2").innerHTML = "";

        //Get First certificate
        var e = document.getElementById('CertListBox1');
        if (e.selectedIndex == -1) {
            alert("Select first certificate");
            return;
        }
        var selectedCertID = e[e.selectedIndex].value;
        var certificate1 = global_selectbox_container[selectedCertID];

        //Get second Certificate
        var e = document.getElementById('CertListBox2');
        if (e.selectedIndex == -1) {
            alert("Select second certificate");
            return;
        }
        var selectedCertID = e[e.selectedIndex].value;
        var certificate2 = global_selectbox_container[selectedCertID];

        var dataToEncr1 = Base64.encode(document.getElementById("DataToEncrTxtBox1").value);
        var dataToEncr2 = Base64.encode(document.getElementById("DataToEncrTxtBox2").value);

        if(dataToEncr1 === "" || dataToEncr2 === "") {
            errormes = "Empty data to encrypt";
            alert(errormes);
            throw errormes;
        }

        try
        {
            var errormes = "";

            try {
                var oSymAlgo = yield cadesplugin.CreateObjectAsync("cadescom.symmetricalgorithm");
            } catch (err) {
                errormes = "Failed to create cadescom.symmetricalgorithm: " + cadesplugin.getLastError(err);
                alert(errormes);
                throw errormes;
            }

            yield oSymAlgo.GenerateKey();

            var oSesKey1 = yield oSymAlgo.DiversifyKey();
            var oSesKey1DiversData = yield oSesKey1.DiversData;
            var oSesKey1IV = yield oSesKey1.IV;
            var EncryptedData1 = yield oSesKey1.Encrypt(dataToEncr1, 1);
            document.getElementById("DataEncryptedDiversData1").innerHTML = escapeHtml(oSesKey1DiversData);
            document.getElementById("DataEncryptedIV1").innerHTML = escapeHtml(oSesKey1IV);
            document.getElementById("DataEncryptedBox1").innerHTML = escapeHtml(EncryptedData1);

            var oSesKey2 = yield oSymAlgo.DiversifyKey();
            var oSesKey2DiversData = yield oSesKey2.DiversData;
            var oSesKey2IV = yield oSesKey2.IV;
            var EncryptedData2 = yield oSesKey2.Encrypt(dataToEncr2, 1);
            document.getElementById("DataEncryptedDiversData2").innerHTML = escapeHtml(oSesKey2DiversData);
            document.getElementById("DataEncryptedIV2").innerHTML = escapeHtml(oSesKey2IV);
            document.getElementById("DataEncryptedBox2").innerHTML = escapeHtml(EncryptedData2);

            var ExportedKey1 = yield oSymAlgo.ExportKey(certificate1);
            document.getElementById("DataEncryptedKey1").innerHTML = escapeHtml(ExportedKey1);

            var ExportedKey2 = yield oSymAlgo.ExportKey(certificate2);
            document.getElementById("DataEncryptedKey2").innerHTML = escapeHtml(ExportedKey2);

            alert("Данные зашифрованы успешно:");
        }
        catch(err)
        {
            errormes = "Ошибка при шифровании данных:" + cadesplugin.getLastError(err);
            alert(errormes);
            throw(errormes);
        }
    });//cadesplugin.async_spawn
}

function Decrypt_Async(certListBoxId) {
    return cadesplugin.async_spawn (function*(arg) {
        document.getElementById("DataDecryptedBox1").innerHTML = "";
        document.getElementById("DataDecryptedBox2").innerHTML = "";

        var e = document.getElementById(arg[0]);
        var selectedCertID = e[e.selectedIndex].value;
        if (selectedCertID == -1) {
            selectedCertID = 0;
        }

        var certificate = global_selectbox_container[selectedCertID];

        var dataToDecr1 = document.getElementById("DataEncryptedBox1").value;
        var dataToDecr2 = document.getElementById("DataEncryptedBox2").value;
        var field;
        if(certListBoxId == 'CertListBox1')
            field ="DataEncryptedKey1";
        else
            field ="DataEncryptedKey2";

        var EncryptedKey = document.getElementById(field).value;
        try
        {
            FillCertInfo_Async(certificate, 'cert_info_decr');
            var errormes = "";

            try {
                var oSymAlgo = yield cadesplugin.CreateObjectAsync("cadescom.symmetricalgorithm");
            } catch (err) {
                errormes = "Failed to create cadescom.symmetricalgorithm: " + cadesplugin.getLastError(err);
                alert(errormes);
                throw errormes;
            }

            yield oSymAlgo.ImportKey(EncryptedKey, certificate);

            var oSesKey1DiversData = document.getElementById("DataEncryptedDiversData1").value;
            var oSesKey1IV = document.getElementById("DataEncryptedIV1").value;
            yield oSymAlgo.propset_DiversData(oSesKey1DiversData);
            var oSesKey1 = yield oSymAlgo.DiversifyKey();
            yield oSesKey1.propset_IV(oSesKey1IV);
            var EncryptedData1 = yield oSesKey1.Decrypt(dataToDecr1, 1);
            document.getElementById("DataDecryptedBox1").innerHTML = escapeHtml(Base64.decode(EncryptedData1));

            var oSesKey2DiversData = document.getElementById("DataEncryptedDiversData2").value;
            var oSesKey2IV = document.getElementById("DataEncryptedIV2").value;
            yield oSymAlgo.propset_DiversData(oSesKey2DiversData);
            var oSesKey2 = yield oSymAlgo.DiversifyKey();
            yield oSesKey2.propset_IV(oSesKey2IV);
            var EncryptedData2 = yield oSesKey2.Decrypt(dataToDecr2, 1);
            document.getElementById("DataDecryptedBox2").innerHTML = escapeHtml(Base64.decode(EncryptedData2));

            alert("Данные расшифрованы успешно:");
        }
        catch(err)
        {
            errormes = "Ошибка при шифровании данных:" + cadesplugin.getLastError(err);
            alert(errormes);
            throw(errormes);
        }
    }, certListBoxId);//cadesplugin.async_spawn
}

function RetrieveCertificate_Async()
{
    cadesplugin.async_spawn (function*(arg) {
        try {
            var PrivateKey = yield cadesplugin.CreateObjectAsync("X509Enrollment.CX509PrivateKey");
        }
        catch (e) {
            alert('Failed to create X509Enrollment.CX509PrivateKey: ' + cadesplugin.getLastError(e));
            return;
        }

        yield PrivateKey.propset_ProviderName("Crypto-Pro GOST R 34.10-2012 Cryptographic Service Provider");
        yield PrivateKey.propset_ProviderType(80);
        yield PrivateKey.propset_KeySpec(1); //XCN_AT_KEYEXCHANGE

        try {
            var CertificateRequestPkcs10 = yield cadesplugin.CreateObjectAsync("X509Enrollment.CX509CertificateRequestPkcs10");
        }
        catch (e) {
            alert('Failed to create X509Enrollment.CX509CertificateRequestPkcs10: ' + cadesplugin.getLastError(e));
            return;
        }

        yield CertificateRequestPkcs10.InitializeFromPrivateKey(0x1, PrivateKey, "");

        try {
            var DistinguishedName = yield cadesplugin.CreateObjectAsync("X509Enrollment.CX500DistinguishedName");
        }
        catch (e) {
            alert('Failed to create X509Enrollment.CX500DistinguishedName: ' + cadesplugin.getLastError(e));
            return;
        }

        var CommonName = "Test Certificate";
        yield DistinguishedName.Encode("CN=\""+CommonName.replace(/"/g, "\"\"")+"\"");

        yield CertificateRequestPkcs10.propset_Subject(DistinguishedName);

        var KeyUsageExtension = yield cadesplugin.CreateObjectAsync("X509Enrollment.CX509ExtensionKeyUsage");
        var CERT_DATA_ENCIPHERMENT_KEY_USAGE = 0x10;
        var CERT_KEY_ENCIPHERMENT_KEY_USAGE = 0x20;
        var CERT_DIGITAL_SIGNATURE_KEY_USAGE = 0x80;
        var CERT_NON_REPUDIATION_KEY_USAGE = 0x40;

        yield KeyUsageExtension.InitializeEncode(
                    CERT_KEY_ENCIPHERMENT_KEY_USAGE |
                    CERT_DATA_ENCIPHERMENT_KEY_USAGE |
                    CERT_DIGITAL_SIGNATURE_KEY_USAGE |
                    CERT_NON_REPUDIATION_KEY_USAGE);

        yield (yield CertificateRequestPkcs10.X509Extensions).Add(KeyUsageExtension);

        try {
            var Enroll = yield cadesplugin.CreateObjectAsync("X509Enrollment.CX509Enrollment");
        }
        catch (e) {
            alert('Failed to create X509Enrollment.CX509Enrollment: ' + cadesplugin.getLastError(e));
            return;
        }
        
        var cert_req;
        try {
            yield Enroll.InitializeFromRequest(CertificateRequestPkcs10);
            cert_req = yield Enroll.CreateRequest(0x1);
        } catch (e) {
            alert('Failed to generate KeyPair or reguest: ' + cadesplugin.getLastError(e));
            return;    
        }

        var params = 'CertRequest=' + encodeURIComponent(cert_req) +
                     '&Mode=' + encodeURIComponent('newreq') +
                     '&TargetStoreFlags=' + encodeURIComponent('0') +
                     '&SaveCert=' + encodeURIComponent('no');

        var xmlhttp = getXmlHttp();
        xmlhttp.open("POST", "https://testgost2012.cryptopro.ru/certsrv/certfnsh.asp", true);
        xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
                if(xmlhttp.status == 200) {
                    cadesplugin.async_spawn (function*(arg) {
                        var response = arg[0];
                        var cert_data = "";
                        var sPKCS7 = "";

                        if (!isIE()) {
                            var start = response.indexOf("var sPKCS7");
                            var end = response.indexOf("sPKCS7 += \"\"") + 13;
                            cert_data = response.substring(start, end).replace(/\\n/g, "");
                        }
                        else {
                            var start = response.indexOf("sPKCS7 & \"") + 9;
                            var end = response.indexOf("& vbNewLine\r\n\r\n</Script>");
                            cert_data = response.substring(start, end).replace(/\\n/g, "");
                            cert_data = cert_data.replace(new RegExp(" & vbNewLine", 'g'), ";");
                            cert_data = cert_data.replace(new RegExp("&", 'g'), "+");
                        }
                        var split_data = cert_data.split('"');
                        for (i = 0; i < split_data.length; i++) {
                            if (i % 2) sPKCS7 += split_data[i];
                        }

                        try {
                            var Enroll = yield cadesplugin.CreateObjectAsync("X509Enrollment.CX509Enrollment");
                        }
                        catch (e) {
                            alert('Failed to create X509Enrollment.CX509Enrollment: ' + cadesplugin.getLastError(e));
                            return;
                        }
                        try {
                            yield Enroll.Initialize(cadesplugin.ContextUser);
                        }
                        catch (err) {
                            alert('Failed to initialize X509Enrollment: ' + cadesplugin.getLastError(err));
                            return;
                        }
                        try {
                            yield Enroll.InstallResponse(cadesplugin.CADESCOM_AllowNone, sPKCS7, cadesplugin.XCN_CRYPT_STRING_ANY, "");
                        }
                        catch (err) {
                            e = cadesplugin.getLastError(err);
                            if (e.indexOf("0x800B0109") !== -1) {
                                note = "Предварительно необходимо установить корневой сертификат тестового УЦ в Доверенные корневые сертификаты\n\n";
                                try {
                                    yield Enroll.InstallResponse(cadesplugin.CADESCOM_AllowUntrustedRoot, sPKCS7, cadesplugin.XCN_CRYPT_STRING_ANY, "");
                                    note = "Сертификат установлен. Однако для создания подписи с использованием данного сертификата может понадобиться " +
                                        "установить корневой сертификат тестового УЦ в Доверенные корневые сертификаты\n\n";
                                }
                                catch (error) {
                                    e = cadesplugin.getLastError(err);
                                }
                                e = note + e;
                            }
                            alert(e);
                        }

                        document.getElementById("boxdiv").style.display = 'none';
                        if(location.pathname.indexOf("simple")>=0) {
                            location.reload();
                        }
                        else if(location.pathname.indexOf("symalgo_sample.html")>=0){
                            FillCertList_Async('CertListBox1', 'CertListBox2');
                        }
                        else{
                            FillCertList_Async('CertListBox');
                        }
                    }, xmlhttp.responseText);//cadesplugin.async_spawn
                }
            }
        }
        xmlhttp.send(params);
    });//cadesplugin.async_spawn
}

function InstallTestCARoot_Async()
{
    cadesplugin.async_spawn (function*(arg) {
        var params = ""
        var xmlhttp = getXmlHttp();
        xmlhttp.open("GET", "https://testgost2012.cryptopro.ru/certsrv/certnew.cer?ReqID=CACert&Renewal=-1&Enc=b64", true);
        xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
                if(xmlhttp.status == 200) {
                    cadesplugin.async_spawn (function*(arg) {
                        var response = arg[0];
                        response = response.replace(/\0/g, '');
                        try {
                            var oCert = yield cadesplugin.CreateObjectAsync("CAdESCOM.Certificate");
                            yield oCert.Import(response);

                            var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                            yield oStore.Open(cadesplugin.CAPICOM_CURRENT_USER_STORE, "ROOT", cadesplugin.CAPICOM_STORE_OPEN_READ_WRITE);
                            yield oStore.Add(oCert);
                            yield oStore.Close();
                            alert("Сертификат установлен.");
                        }
                        catch (err) {
                            note = "Не удалось установить корневой сертификат тестового УЦ в Доверенные корневые сертификаты\n\n";
                            e = note + cadesplugin.getLastError(err);
                            alert(e);
                            return;
                        }

                        document.getElementById("boxdiv").style.display = 'none';
                        if(location.pathname.indexOf("simple")>=0) {
                            location.reload();
                        }
                        else if(location.pathname.indexOf("symalgo_sample.html")>=0){
                            FillCertList_Async('CertListBox1', 'CertListBox2');
                        }
                        else {
                            selectedIndex = document.getElementById('CertListBox').selectedIndex;
                            FillCertList_Async('CertListBox', null, null, selectedIndex);
                        }
                    }, xmlhttp.responseText);//cadesplugin.async_spawn
                }
            }
        }
        xmlhttp.send(params);
    });//cadesplugin.async_spawn
}

function InstallCertificate_Async(certBoxId)
{
    if (typeof(certBoxId) === 'undefined')
        return;
    cadesplugin.async_spawn(function*() {
        var e = document.getElementById(certBoxId);
        if (e.selectedIndex === -1) {
            selectedCertID = 0;
        }
        var selectedCertID = e[e.selectedIndex].value;
        var certificate = global_selectbox_container[selectedCertID];
        if (!global_isFromCont[selectedCertID]) {
            alert("Сертификат уже установлен в хранилище");
            FillCertInfo_Async(certificate, certBoxId, global_isFromCont[selectedCertID]);
            return;
        }

        var data = yield certificate.Export(cadesplugin.CADESCOM_ENCODE_BASE64);

        try {
            var Enroll = yield cadesplugin.CreateObjectAsync("X509Enrollment.CX509Enrollment");
        }
        catch (e) {
            alert('Failed to create X509Enrollment.CX509Enrollment: ' + cadesplugin.getLastError(e));
            return;
        }
        try {
            yield Enroll.Initialize(cadesplugin.ContextUser);
        }
        catch (err) {
            alert('Failed to initialize X509Enrollment: ' + cadesplugin.getLastError(err));
            return;
        }
        try {
            yield Enroll.InstallResponse(
                cadesplugin.CADESCOM_UseContainerStore |
                cadesplugin.CADESCOM_AllowNone,
                data, cadesplugin.XCN_CRYPT_STRING_BASE64_ANY, "");
        }
        catch (err) {
            e = cadesplugin.getLastError(err);
            if (e.indexOf("0x800B0109") !== -1) {
                e = "Ошибка: корневой сертификат УЦ не установлен в Доверенные корневые сертификаты\n\n" + e;
            }
            alert(e);
            return;
        }
        global_isFromCont[selectedCertID] = false;
        FillCertInfo_Async(certificate, certBoxId, global_isFromCont[selectedCertID]);
        alert("Сертификат установлен в Личные сертификаты");
    });//cadesplugin.async_spawn
}

function VerifySignature_Async(SignatureBoxId, SignInfoBoxId, LoaderId) {
    return cadesplugin.async_spawn(function* (args) {
        try {
            var srcBox = document.getElementById(args[0]);
            var destBox = document.getElementById(args[1]);
            var loader = document.getElementById(args[2]);

            document.getElementById('toggle_extended_text').style.display = 'none';
            if (destBox != null && destBox.style != null) {
                destBox.style.display = 'none';
            }
            var sSignedMessage = srcBox.value;
            if (sSignedMessage == "") {
                throw ("Отсутствует подпись для проверки");
            }
            if (loader != null && loader.style != null) {
                loader.style.display = '';
            }

            var Adjust = new CertificateAdjuster();
            var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");

            var targRadios = document.getElementsByName('signTargetType');
            var targRadiosLen = targRadios.length;
            var signType = cadesplugin.CADESCOM_CADES_X_LONG_TYPE_1;
            var bsignTypeAuto = false;
            for (i = 0; i < targRadiosLen; i++) {
                if (targRadios[i].checked) {
                    if (targRadios[i].value === "CADES-AUTO") {
                        bsignTypeAuto = true;
                        break;
                    }
                    if (targRadios[i].value === "CADES-BES") {
                        signType = cadesplugin.CADESCOM_CADES_BES;
                        break;
                    }
                    if (targRadios[i].value === "CADES-T") {
                        signType = cadesplugin.CADESCOM_CADES_T;
                        break;
                    }
                    if (targRadios[i].value === "CADES-XLT1") {
                        signType = cadesplugin.CADESCOM_CADES_X_LONG_TYPE_1;
                        break;
                    }
                    if (targRadios[i].value === "PKCS7") {
                        signType = cadesplugin.CADESCOM_PKCS7_TYPE;
                        break;
                    }
                }
            }

            var verifyResult = "Результат проверки неизвестен";
            var verifyResultSuccess = '<font color="green">Подпись проверена успешно</font>';
            var certThumbprints = [];
            for (; ;) {
                try {
                    yield oSignedData.VerifyCades(sSignedMessage, signType);
                }
                catch (ex) {
                    verifyResult = cadesplugin.getLastError(ex);
                    if (bsignTypeAuto) {
                        // Перебираем все типы подписей, пока атрибуты в подписи не подойдут под тип
                        if (verifyResult.indexOf("0x8009100F") >= 0 ||
                            verifyResult.indexOf("0x8009200E") >= 0 ||
                            verifyResult.indexOf("0x80070490") >= 0) {
                            signType = getNextSignType(signType);
                        } else {
                            break;
                        }
                        if (!signType) {
                            break;
                        }
                        continue;
                    }
                    break;
                }
                verifyResult = verifyResultSuccess;
                break;
            }
            if (verifyResult != verifyResultSuccess)
                verifyResult = '<font color="red">' +  verifyResult + '</font>';
            var sSignType = getSignTypeString(signType);
            var result = "";
            result += "Тип подписи: <b>" + sSignType + "</b><br/>"
            result += "Результат проверки: <b>" + verifyResult + "</b><br/><br/>"

            try {
                var oSigners = yield oSignedData.Signers;
                var nSigners = yield oSigners.Count;
                result += "Подписанты: <b>" + nSigners + "</b><br/>"

                var Adjust = new CertificateAdjuster();
                for (var i = 1; i <= nSigners; i++) {
                    var oSigner = yield oSigners.Item(i);
                    var oCert = yield oSigner.Certificate;
                    var oSignStatus = yield oSigner.SignatureStatus;
                    var isValidSignStatus = yield oSignStatus.IsValid;
                    var isValidSign = "Ошибка при проверке подписи";
                    if (isValidSignStatus) {
                        isValidSign = "Подпись проверена успешно";
                    }
                    var isValidCertStatus = yield oCert.IsValid();
                    isValidCertStatus = yield isValidCertStatus.Result;
                    var isValidCert = "Ошибка при проверке статуса сертификата";
                    if (isValidCertStatus) {
                        isValidCert = "Сертификат действителен";
                    }

                    var subject = "-";
                    var issuer = "-";
                    var validFrom = "-";
                    var validTo = "-";
                    var thumbprint = "-";
                    var signingTime = "-";
                    try {
                        subject = escapeHtml(Adjust.GetCertName(yield oCert.SubjectName));
                        issuer = escapeHtml(Adjust.GetIssuer(yield oCert.IssuerName));
                        validFrom = escapeHtml(Adjust.GetCertDate(yield oCert.ValidFromDate)) + " UTC";
                        validTo = escapeHtml(Adjust.GetCertDate(yield oCert.ValidToDate)) + " UTC";
                        thumbprint = yield oCert.Thumbprint;
                        certThumbprints.push(thumbprint);
                        signingTime = escapeHtml(Adjust.GetCertDate(yield oSigner.SigningTime)) + " UTC";
                    }
                    catch (ex) { }
                    result += i + ". Владелец: <b>" + subject + "</b><br/>";
                    result += "&emsp;Издатель: <b>" + issuer + "</b><br/>";
                    result += "&emsp;Выдан: <b>" + validFrom + "</b><br/>";
                    result += "&emsp;Действителен до: <b>" + validTo + "</b><br/>";
                    result += "&emsp;Отпечаток: <b>" + thumbprint + "</b><br/>";
                    result += "&emsp;Статус сертификата: <b>" + isValidCert + "</b><br/>";
                    result += "&emsp;Дата подписи: <b>" + signingTime + "</b><br/>";
                    result += "&emsp;Статус подписи: <b>" + isValidSign + "</b><br/><br/>";
                }

            }
            catch (ex) { }
            document.getElementById('verifyResult').innerHTML = result;

            var resultExt = "";
            try {
                var oCerts = yield oSignedData.Certificates;
                var nCerts = yield oCerts.Count;
                var certIndex = 0;
                for (var i = 1; i <= nCerts; i++) {
                    var oCert = yield oCerts.Item(i);
                    var thumbprint = yield oCert.Thumbprint;
                    if (certThumbprints.indexOf(thumbprint) >= 0)
                        continue;
                    var isValidCertStatus = yield oCert.IsValid();
                    isValidCertStatus = yield isValidCertStatus.Result;
                    var isValidCert = "Ошибка при проверке статуса сертификата";
                    if (isValidCertStatus) {
                        isValidCert = "Сертификат действителен";
                    }

                    var subject = "-";
                    var issuer = "-";
                    var validFrom = "-";
                    var validTo = "-";
                    var signingTime = "-";
                    try {
                        subject = escapeHtml(Adjust.GetCertName(yield oCert.SubjectName));
                        issuer = escapeHtml(Adjust.GetIssuer(yield oCert.IssuerName));
                        validFrom = escapeHtml(Adjust.GetCertDate(yield oCert.ValidFromDate)) + " UTC";
                        validTo = escapeHtml(Adjust.GetCertDate(yield oCert.ValidToDate)) + " UTC";
                        certThumbprints.push(thumbprint);
                    }
                    catch (ex) { }

                    resultExt += ++certIndex + ". Владелец: <b>" + subject + "</b><br/>";
                    resultExt += "&emsp;Издатель: <b>" + issuer + "</b><br/>";
                    resultExt += "&emsp;Выдан: <b>" + validFrom + "</b><br/>";
                    resultExt += "&emsp;Действителен до: <b>" + validTo + "</b><br/>";
                    resultExt += "&emsp;Отпечаток: <b>" + thumbprint + "</b><br/>";
                    resultExt += "&emsp;Статус сертификата: <b>" + isValidCert + "</b><br/><br/>";
                }
                if (resultExt != "") {
                    resultExt = "Другие сертификаты из подписи: <br />" + resultExt;
                    document.getElementById('toggle_extended_text').style.display = '';
                    document.getElementById('extended_text').innerHTML = resultExt;
                }
            }
            catch (ex) { }

            loader.style.display = 'none';
            if (destBox != null && destBox.style != null) {
                destBox.style.display = '';
            }
            document.getElementById('verifyResult').innerHTML = result;
        }
        catch(err)
        {
            loader.style.display = 'none';
            alert(cadesplugin.getLastError(err))
        }
    }, SignatureBoxId, SignInfoBoxId, LoaderId); //cadesplugin.async_spawn
}

function ExportCert_Async(certListBoxId) {
    return cadesplugin.async_spawn(function*(arg) {
        var e = document.getElementById(arg[0]);
        var selectedCertID = e.selectedIndex;
        if (selectedCertID == -1) {
            alert("Выберите сертификат");
            return;
        }

        var certificate = global_selectbox_container[selectedCertID];
        try
        {
            var data = yield certificate.Export(cadesplugin.CADESCOM_ENCODE_BASE64);
            var data_arr = Base64ToBase32(data).split('')
            var preparedData = []
            while (data_arr.length) preparedData.push(data_arr.splice(0, 1000).join(''))
            BindQr(preparedData)
        }
        catch(err)
        {
            alert(cadesplugin.getLastError(err))
        }
    }, certListBoxId); //cadesplugin.async_spawn
}

function CheckForPlugInUEC_Async()
{
    var isUECCSPInstalled = false;

    cadesplugin.async_spawn(function *() {
        var oAbout = yield cadesplugin.CreateObjectAsync("CAdESCOM.About");

        var UECCSPVersion;
        var CurrentPluginVersion = yield oAbout.PluginVersion;
        if( typeof(CurrentPluginVersion) == "undefined")
            CurrentPluginVersion = yield oAbout.Version;

        var PluginBaseVersion = "1.5.1633";
        var arr = PluginBaseVersion.split('.');

        var isActualVersion = true;

        if((yield CurrentPluginVersion.MajorVersion) == parseInt(arr[0]))
        {
            if((yield CurrentPluginVersion.MinorVersion) == parseInt(arr[1]))
            {
                if((yield CurrentPluginVersion.BuildVersion) == parseInt(arr[2]))
                {
                    isActualVersion = true;
                }
                else if((yield CurrentPluginVersion.BuildVersion) < parseInt(arr[2]))
                {
                    isActualVersion = false;
                }
            }else if((yield CurrentPluginVersion.MinorVersion) < parseInt(arr[1]))
            {
                    isActualVersion = false;
            }
        }else if((yield CurrentPluginVersion.MajorVersion) < parseInt(arr[0]))
        {
            isActualVersion = false;
        }

        if(!isActualVersion)
        {
            setStateForPlugin(Colors.INFO, "Плагин загружен, но он не поддерживает УЭК.");
        }
        else
        {
            setStateForPlugin(Colors.SUCCESS, "Плагин загружен");

            try
            {
                var oUECard = yield cadesplugin.CreateObjectAsync("CAdESCOM.UECard");
                UECCSPVersion = yield oUECard.ProviderVersion;
                isUECCSPInstalled = true;
            }
            catch (err)
            {
                UECCSPVersion = "Нет информации";
            }

            if(!isUECCSPInstalled)
            {
                setStateForPlugin(Colors.INFO, "Плагин загружен. Не установлен УЭК CSP.");
            }
        }
        document.getElementById('PlugInVersionTxt').innerHTML = escapeHtml("Версия плагина: " + (yield CurrentPluginVersion.toString()));
        document.getElementById('CSPVersionTxt').innerHTML = escapeHtml("Версия УЭК CSP: " + (yield UECCSPVersion.toString()));
    }); //cadesplugin.async_spawn
}

function FoundCertInStore_Async(cerToFind) {
    return new Promise(function(resolve, reject){
        cadesplugin.async_spawn(function *(args) {

            if((typeof cerToFind == "undefined") || (cerToFind == null))
                args[0](false);

            var oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.store");
            if (!oStore) {
                alert("store failed");
                args[0](false);
            }
            try {
                yield oStore.Open();
            }
            catch (ex) {
                alert("Certificate not found");
                args[0](false);
            }

            var Certificates = yield oStore.Certificates;
            var certCnt = yield Certificates.Count;
            if(certCnt==0)
            {
                oStore.Close();
                args[0](false);
            }

            var ThumbprintToFind = yield cerToFind.Thumbprint;

            for (var i = 1; i <= certCnt; i++) {
                var cert;
                try {
                    cert = yield Certificates.Item(i);
                }
                catch (ex) {
                    alert("Ошибка при перечислении сертификатов: " + cadesplugin.getLastError(ex));
                    args[0](false);
                }

                try {
                    var Thumbprint = yield cert.Thumbprint;
                    if(Thumbprint == ThumbprintToFind) {
                        var dateObj = new Date();
                        var ValidToDate = new Date(yield cert.ValidToDate);
                        var HasPrivateKey = yield cert.HasPrivateKey();
                        var IsValid = yield cert.IsValid();
                        IsValid = yield IsValid.Result;

                        if(dateObj<ValidToDate && HasPrivateKey && IsValid) {
                            args[0](true);
                        }
                    }
                    else {
                        continue;
                    }
                }
                catch (ex) {
                    alert("Ошибка при получении свойства Thumbprint: " + cadesplugin.getLastError(ex));
                    args[0](false);
                }
            }
            oStore.Close();

            args[0](false);

        }, resolve, reject);
    });
}

function getUECCertificate_Async() {
    return new Promise(function(resolve, reject)
        {
            showWaitMessage("Выполняется загрузка сертификата, это может занять несколько секунд...");
            cadesplugin.async_spawn(function *(args) {
                try {
                    var oCard = yield cadesplugin.CreateObjectAsync("CAdESCOM.UECard");
                    var oCertTemp = yield oCard.Certificate;

                    if(typeof oCertTemp == "undefined")
                    {
                        document.getElementById("cert_info1").style.display = '';
                        document.getElementById("certerror").innerHTML = "Сертификат не найден или отсутствует.";
                        throw "";
                    }

                    if(oCertTemp==null)
                    {
                        document.getElementById("cert_info1").style.display = '';
                        document.getElementById("certerror").innerHTML = "Сертификат не найден или отсутствует.";
                        throw "";
                    }

                    if(yield FoundCertInStore_Async(oCertTemp)) {
                        FillCertInfo_Async(oCertTemp);
                        g_oCert = oCertTemp;
                    }
                    else {
                        document.getElementById("cert_info1").style.display = '';
                        document.getElementById("certerror").innerHTML = "Сертификат не найден в хранилище MY.";
                        throw "";
                    }
                    args[0]();
                }
                catch (e) {
                    var message = cadesplugin.getLastError(e);
                    if("The action was cancelled by the user. (0x8010006E)" == message) {
                        document.getElementById("cert_info1").style.display = '';
                        document.getElementById("certerror").innerHTML = "Карта не найдена или отсутствует сертификат на карте.";
                    }
                    args[1]();
                }
            }, resolve, reject);
        });
}

function createSignature_Async() {
    return new Promise(function(resolve, reject){
        cadesplugin.async_spawn(function *(args) {
            var signedMessage = "";
            try {
                var oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                yield oSigner.propset_Certificate(g_oCert);
                yield oSigner.propset_Options(cadesplugin.CAPICOM_CERTIFICATE_INCLUDE_END_ENTITY_ONLY);

                var oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                yield oSignedData.propset_Content("DataToSign");

                var CADES_BES = 1;
                signedMessage = yield oSignedData.SignCades(oSigner, CADES_BES);
                args[0](signedMessage);
            }
            catch (e) {
                showErrorMessage("Ошибка: Не удалось создать подпись. Код ошибки: " + cadesplugin.getLastError(e));
                args[1]("");
            }
            args[0](signedMessage);
        }, resolve, reject);
    });
}

function verifyCert_Async() {
    if (!g_oCert) {
        removeWaitMessage();
        return;
    }
    createSignature_Async().then(
        function(signedMessage){
            document.getElementById("SignatureTxtBox").innerHTML = escapeHtml(signedMessage);
            var x = document.getElementsByName("SignatureTitle");
            x[0].innerHTML = "Подпись сформирована успешно:";
            removeWaitMessage();
        },
        function(signedMessage){
            removeWaitMessage();
        }
    );
}

function isIE() {
    var retVal = (("Microsoft Internet Explorer" == navigator.appName) || // IE < 11
        navigator.userAgent.match(/Trident\/./i)); // IE 11
    return retVal;
}

async_resolve();
