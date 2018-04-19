/*Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var request = require('request');
var Cloudant = require('cloudant');

var LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/IBM_logo.svg/512px-IBM_logo.svg.png";
var CONTENT_TYPE = "image/png";
var IMAGE_NAME_PREFIX = "IBM_logo";
var IMAGE_NAME_POSTFIX = ".png";
const btoa = require("btoa");
const wml_credentials = new Map();
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

/**
 * This action downloads an IBM logo, and returns an object to be written to a cloudant database.
 * This action is idempotent. If it fails, it can be retried.
 *
 * @param   params.CLOUDANT_USERNAME               Cloudant username
 * @param   params.CLOUDANT_PASSWORD               Cloudant password
 * @param   params.CLOUDANT_DATABASE               Cloudant database to store the file to

 * @return  Promise for the downloaded image object
 */
 
 
function apiGet(url, username, password, loadCallback, errorCallback){
    var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
    const oReq = new XMLHttpRequest();
    const tokenHeader = "Basic " + btoa((username + ":" + password));
    const tokenUrl = url + "/v3/identity/token";

    oReq.addEventListener("load", loadCallback);
    oReq.addEventListener("error", errorCallback);
    oReq.open("GET", tokenUrl);
    oReq.setRequestHeader("Authorization", tokenHeader);
    oReq.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    oReq.send();
}

function apiPost(scoring_url, token, payload, loadCallback, errorCallback){

    const oReq = new XMLHttpRequest();
    oReq.addEventListener("load", loadCallback);
    oReq.addEventListener("error", errorCallback);
    oReq.open("POST", scoring_url);
    oReq.setRequestHeader("Accept", "application/json");
    oReq.setRequestHeader("Authorization", token);
    oReq.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    oReq.send(payload);
}
 
function main(params) {
console.log("trigger is used");
  // Configure database connection
  var cloudant = new Cloudant({
    account: params.CLOUDANT_USERNAME,
    password: params.CLOUDANT_PASSWORD
  });
  var database = cloudant.db.use(params.CLOUDANT_DATABASE);

  // Generate a random name to trigger the database change feed
//  var imageName = IMAGE_NAME_PREFIX + getRandomInt(1, 100000) + IMAGE_NAME_POSTFIX;

  return new Promise(function(resolve, reject) {
  var record = params;

// NOTE: you must manually construct wml_credentials hash map below using information retrieved
// from your IBM Cloud Watson Machine Learning Service instance

wml_credentials.set("url", "https://ibm-watson-ml.mybluemix.net");
wml_credentials.set("username", "8045bcae-dbc8-40fe-ba6a-186ee3bf5ab7");
wml_credentials.set("password", "3d8019b1-55cd-4f59-a0f8-8a3822da6948");

apiGet(wml_credentials.get("url"),
    wml_credentials.get("username"),
    wml_credentials.get("password"),
    function (res) {
        let parsedGetResponse;
        try {
            parsedGetResponse = JSON.parse(this.responseText);
        } catch(ex) {
            // TODO: handle parsing exception
        }
        if (parsedGetResponse && parsedGetResponse.token) {
            const token = parsedGetResponse.token
            const wmlToken = "Bearer " + token;

            // NOTE: manually define and pass the array(s) of values to be scored in the next line
            const payload = JSON.stringify({"fields": ["title", "text", "author", "url"], "values": [[record.title,record.text,record.author,record.url]]});
            var scoring_url = 'https://ibm-watson-ml.mybluemix.net/v3/wml_instances/a05fe3dd-2405-4634-8582-65e6fd7f81ac/published_models/7d0fb486-d0b1-4bf4-a06a-0ca93a615519/deployments/c88dd227-0eb3-45d6-985d-cbf417aa73bf/online';

            apiPost(scoring_url, wmlToken, payload, function (resp) {
                let parsedPostResponse;
                try {
                    console.log(this.responseText);
                    parsedPostResponse = JSON.parse(this.responseText);
                } catch (ex) {
                    // TODO: handle parsing exception
                }
                console.log("Scoring response");
                console.log(parsedPostResponse);
           if (parsedPostResponse.values[0][8] == "True") {
                record.status = 'Legitimated'
            }
            else {
                record.status = 'Fake'
            }
            record.probability = 100
            delete record['CLOUDANT_PASSWORD']
            delete record['CLOUDANT_USERNAME']
            delete record['CLOUDANT_DATABASE']    
            
        database.insert(record,
          function(err, body) {
            if (err && err.statusCode != 409) {
              console.log("Error with file insert." + err);
              reject();
            } else {
              console.log("Success with file insert.");
              resolve();
            }
          }
        );
            }, function (error) {
                console.log(error);
            });
        } else {
            console.log("Failed to retrieve Bearer token");
        }
    }, function (err) {
        console.log(err);
    });

});
}


