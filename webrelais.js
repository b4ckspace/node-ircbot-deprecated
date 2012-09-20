var https = require('https');
var url = require('url');
var webrelaisbase = "https://webrelais.bckspc.de/relais/";

module.exports.activate = function(number){
    var options = url.parse(webrelaisbase + number);
    options.method='POST';
    options.headers={'Content-length':0};
    //console.log(options);
    //https.request(options, function(res){console.log("res: " + res)}).end();

    var req = https.request(options, function(res) {
      // console.log('STATUS: ' + res.statusCode);
      // console.log('HEADERS: ' + JSON.stringify(res.headers));
      // res.setEncoding('utf8');
      // res.on('data', function (chunk) {
      //   console.log('BODY: ' + chunk);
      // });
    });

    // req.on('error', function(e) {
    //   console.log('problem with request: ' + e.message);
    // });

    // write data to request body
    req.end();

};

module.exports.deactivate = function(number){
    var options = url.parse(webrelaisbase + number);
    options.method='DELETE';
    options.headers={'Content-length':0};
    https.request(options, function(){}).end();
};