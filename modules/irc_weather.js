var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "WEATHER";

var util = require('util');
var http = require('http');

var town = 'Bamberg,Germany';
var weatherbase = 'http://api.openweathermap.org/data/2.1/find/name?q=';
var currentweather = undefined;
var fetchTimeout = 5 * 60 * 1000;

var updateWeather = function(){
    var url = weatherbase + town;
    LOGGER.debug("fetch new data, url: %s", url);
    http.get(url, function(res){
        var resString = '';

        res.setEncoding('utf8');

        res.on( 'data', function( data ) {
            resString += data;
        } );
        res.on('end', function(){
            var status;
            try{
                status = JSON.parse(resString);
            }catch(e){
                LOGGER.error("json parse error: " + e.message);
                return;
            }
            var temp = status.list[0].main.temp - 273.15; //temp is in kelvin
            var weather = status.list[0].weather[0].main;
            currentweather = weather + "(" + temp + "°C)";
        });
    }).on('error', function(e) {
        LOGGER.error("Got http status error error: " + e.message);
    });
    setTimeout(updateWeather, fetchTimeout);
};


(COMMANDS['!weather'] = function(sender, to, user){
    if(currentweather){
        this.reply(sender, to, currentweather);
        return;
    }
    this.reply(sender, to, "no weather data fetched yet.");
}).helptext = "get current weather data.";

COMMANDS['!wetter'] = COMMANDS['!weather'];

module.exports = function(cfg, log, bot){
    LOGGER = log.getLogger(MODULE_NAME);
    CONFIG = cfg;
    updateWeather();
    for(key in FILTERS){
        bot.filters[key] = FILTERS[key];
    }
    return {commands:COMMANDS};
};