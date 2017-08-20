var http = require('http');
var AlexaSkill = require('./AlexaSkill');
var fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var APP_ID = 'boneless MEME';


var getSchedule = function(data){
    var timings="";
    for(var i=0; i<data.length; i++)
    {
        timings+=data[i].routeTitle + " in "+ data[i].timeMinutes + (data[i].timeMinutes== 1? " minute": " minutes");
        if(i<(data.length-1))
        {
            timings+=", ";
            if(i==(data.length-2))
            {
                timing+="and ";
            }
        }
        else timings+=".";
    }
    return timings;
};

var getBuses= function(stopId, buses, callback){
    var url='http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=rutgers&stopId='+stopId;
    http.get(url,function(resp)
                    {
                        var lake = '';
                        resp.on('error', function(err) 
                        {
                        console.log('Error while reading', err);
                        });
                        resp.on('body', function(data) 
                        {
                            lake+=data;
                        });                                        
                        var data= [];
                        var reply = xml2js.parseString(resp, function (err, result)
                        {
                            for (var i = 0; i<result.body.predictions.length; i++)
                            {
                                var predictions = result.body.predictions[i];
                                if(predictions.direction!== undefined && buses.indexOf(predictions.$.routeTag) != -1)
                                {
                                    for (var j = 0; j < predictions.direction.length; j++) 
                                    {
                                        for (var k = 0; k < predictions.direction[j].prediction.length; k++)
                                        {
                                            var sched = {};
                                            sched.routeTitle = predictions.$.routeTitle;
                                            schedule.timeMinutes = Number(predictions.direction[j].prediction[k].$.minutes);
                                            data[data.length] = schedule;
                                        }
                                    }
                                }
                            }
                            data.sort(function(a,b){
                                if (a.timeMinutes<b.timeMinutes) return -1;
                                if (a.timeMinutes>b.timeMinutes) return 1;
                                return 0;
                            });
                        });
                        if(reply.error)
                        {
                            console.log("error "+reply.error.message)
                        }
                        else
                        {
                            callback(0, getSchedule(data));
                        }
    });
};