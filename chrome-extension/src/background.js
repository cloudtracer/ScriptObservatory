/*
 *
 * This file (background.js) implements the basic ScriptObservatory functionality.
 *
 * The content here is loaded in the background within the "background page" Chrome sets up for
 * the extension. The main functionality is implemented within the chrome.webRequest.onBeforeRequest
 * listener, which is called by the browser whenever a request is about to be made.
 *
 */


/* 
 * CONSTANTS
 */
API_BASE_URL = "https://scriptobservatory.org/api/script";


/*
 * httpGet(url) - Perform a HTTP GET request to *url* and return its content
 */
function httpGet(url){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", url, false);
    xmlHttp.send();
    return xmlHttp.responseText;  // TODO: check return code
}


/*
 * httpPost(url, data) - Send json-ified *data* with a HTTP POST request to *url*
 */
function httpPost(url, data){
    var request = new XMLHttpRequest();
    request.open("POST", url, true);
    request.setRequestHeader("Content-Type", "application/json");
    request.send(JSON.stringify(data));
    return;  // TODO: check return code
}


/*
 * makeIdString(tabId, frameId)) - Create a unique ID string from *tabId* and *frameId*
 *
 * this is used to try to detect the parent frame that is responsible for a given request.
 * frameId is only unique on a per-tab basis, so both are needed.
 *
 * more info: https://developer.chrome.com/extensions/webRequest
 */
function makeIdString(tabId, frameId){
    return tabId + "-" + frameId;
}


/* 
 * We hook into chrome.webRequest.onBeforeRequest to perform our own download of the content and calculate the
 * sha256 hash of the content. After the download is complete, we POST the url & hash value to *API_BASE_URL* 
 * and embed the content in the webpage by changing the URL to a data URI object (avoids downloading content twice).
 * 
 * It would be nice if we could let the browser do the request normally and grab the content of its response,
 * but this is not currently possible with the chrome APIs. 
 *
 * This functionality is discussed in the following issue: 
 *   https://code.google.com/p/chromium/issues/detail?id=104058
 * 
 * A draft proposal for adding this functionality is here: 
 *   https://groups.google.com/a/chromium.org/forum/#!msg/apps-dev/v176iCmRgSs/iM-72Evf8JgJ
 *
 * More information is available in the chrome.webRequest docs: 
 *   https://developer.chrome.com/extensions/webRequest
 */
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        var data = "";
        var hash = "";
        var parent_url = "";  // only set non-Null for scripts

        if (details.type == "main_frame" || details.type == "sub_frame"){
            var id_string = makeIdString(details.tabId, details.frameId);
            PARENT_URLS[id_string] = details.url;
        }
        if (details.type == "script"){
            data = httpGet(details.url);
            hash = CryptoJS.SHA256(data).toString(CryptoJS.enc.Base64);
        }
        if (details.type == "script" || details.type == "sub_frame"){
            var id_string = makeIdString(details.tabId, details.frameId);
            if (id_string in PARENT_URLS){
                parent_url = PARENT_URLS[id_string];
            }
        }
        
        var post_data = {"url": details.url, 
                         "parent_url": parent_url,
                         "sha256": hash, 
                         "date": details.timeStamp};

        // TODO batch up multiple post_datas to send to server more than one at a time
   
        httpPost(API_BASE_URL, post_data);

        if (details.type == "script") {
            return {"redirectUrl":"data:text/html;base64, " + window.btoa(data)};
        }
        else {
            return {cancel: false};
        }

    }, 
    {urls: ["<all_urls>"], types: ["script", "main_frame", "sub_frame"]}, 
    ["blocking"]
);


/*
 * The current use of PARENT_URLS is an ugly hack to try to keep track of the URL of 
 * each page that could possibly spawn a javascript request later on.
 * 
 * Once the onBeforeRequest listener is expanded to grab all types of pages, the URLs
 * and parent/children relationships should be recorded there...
 * 
 * The current setup will fail in cases like news.ycombinator.com, where the initial
 * request actually returns a javascript object that then pulls down the page content.
 */

PARENT_URLS = {};

