var FILTERS = {};
var COMMANDS = {};
var LOGGER;
var CONFIG;

var MODULE_NAME = "WEATHER";

var util=require('util');
var feedparser = require('feedparser');

var wid = '636766';
var weatherbase = 'http://weather.yahooapis.com/forecastrss?u=c&w=';
var weatherdata = undefined;
var fetchTimeout = 5 * 60 * 1000;

var updateWeather = function(){
    LOGGER.debug("fetch new data, url: %s%s", weatherbase, wid);
    feedparser.parseUrl(weatherbase + wid, {}, function(error, meta, arts){
        if(error){
            LOGGER.error(error);
            return;
        }
        var today = arts[0]['yweather:condition']['@'];
        var todayinfo = today['text'] + " " + today['temp'] + '°C';
        var forecast = arts[0]['yweather:forecast'][1]['@'];
        var forecastinfo =  'tomorrow (' + forecast['day'] + "): " + forecast['low']
                            + "-" + forecast['high'] + "°C " + forecast['text'];
        weatherdata = todayinfo + ' ' + forecastinfo;
    });
    setTimeout(updateWeather, fetchTimeout);
};


(COMMANDS['!weather'] = function(sender, to, user){
    this.reply(sender, to, weatherdata);
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