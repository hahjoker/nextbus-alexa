var http = require('http');
var AlexaSkill = require('./AlexaSkill');
var fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var APP_ID = 'amzn1.ask.skill.23a7845f-753e-49ef-9a35-cd8095b460d9';
var concat = require('concat-stream');

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
                timings+="and ";
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
                        resp.on('error', function(err) 
                        {
                        console.log('Error while reading', err);
                        });
                        resp.pipe(concat(function(buffer) {
                            var lake = buffer.toString();                               
                        var data= [];
                        var reply = xml2js.parseString(lake, function (err, result)
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
                                            sched.timeMinutes = Number(predictions.direction[j].prediction[k].$.minutes);
                                            data[data.length] = sched;
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
                            console.log("error "+reply.error.message);
                        }
                        else
                        {
                            callback(0, getSchedule(data));
                        }
                    }));
    });
};

var getXMLNextBus =function (stopId,callback){
    var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=rutgers&stopId='+stopId;
    http.get(url, function(resp){
        var data = [];
        resp.pipe(concat(function(buffer) {
            var lake = buffer.toString();
        var reply = xml2js.parseString(lake, function(err, result){
            for(var i=0; i<result.body.predictions.length; i++){
                var predictions = result.body.predictions[i];
                if(predictions.direction !==undefined)
                {
                    data[data.length] = predictions.$.routeTag;
                }
            }
        });
        if(reply.error)
        {
            console.log("error "+reply.error.message);
        }
        else
        {
            callback(0, data);
        }
    }));        
    });
};

var ruBusTracker=function(){
    AlexaSkill.call(this, APP_ID);
};
var handleRequest = function(intent, response){
    var output, redo;
    if((intent.slots.destination.value)===undefined){
        output= "No destination bus stop. Please say source and then destination.";
        redo = "What are the bus stops that you are looking at?";
        response.ask(output, redo);
    }
    else if ((intent.slots.source.value) === undefined) {
        output= "No source bus stop. Please say source and then destination.";
        redo = "What are the bus stops that you are looking at?";
        response.ask(output, redo);
    }
    
    else if ((BUS_STOPS.indexOf((intent.slots.source.value).toUpperCase()) == -1) || (BUS_STOPS.indexOf((intent.slots.destination.value).toUpperCase()) == -1)) {
        output = "I have never heard of that bus stop.";
        redo = "What are the bus stops that you are looking at?";
        response.ask(output, redo);
    }
    else{
        var buses = [];
        var source, destination, sourceStopId, destinationStopId;
        fs.readFile("/var/task/DB.xml", function (err, content) {
            parser.parseString(content, function(err, result) {
                for (var i = 0; i < result.body.stop.length; i++) {
                    var busStop = result.body.stop[i];
                    var sEqual = (busStop.$.name).toUpperCase() === (intent.slots.source.value).toUpperCase();
                    if (sEqual) sourceStopId = busStop.$.id;
                    var dEqual = (busStop.$.name).toUpperCase() === (intent.slots.destination.value).toUpperCase();
                    if (dEqual) destinationStopId = busStop.$.id;
                }
                getXMLNextBus(sourceStopId, function(err, sourceStops) {
                    if (err) console.log("Error!");
                    else source = sourceStops;
                    
                    getXMLNextBus(destinationStopId, function(err, destinationStops) {
                        if (err) console.log("Error!");
                        else destination = destinationStops;
                        
                        for (var x in source) {
                            for (var y in destination) {
                                if (source[x] === destination[y]) buses[buses.length] = source[x];
                            }
                        }
                        
                        getBuses(sourceStopId, buses, function(err, data) {
                            var speechOutput;
                            if (err) speechOutput = "Sorry! Rutgers Bus Tracker is experiencing a problem. Please try again later";
                            else {
                                if (data) speechOutput = "The next buses are " + data;
                                else speechOutput = "There are no direct buses from " + intent.slots.source.value + " to " + intent.slots.destination.value;
                            }
                            
                            var heading = "Bus Schedules";
                            response.tellWithCard(speechOutput, heading, speechOutput);
                        });
                    });
                });
            });
        });
    }
}


ruBusTracker.prototype = Object.create(AlexaSkill.prototype);
ruBusTracker.prototype.constructor = ruBusTracker;

ruBusTracker.prototype.eventHandlers.onLaunch = function(launchRequest, session, response) {
var output = 'Rutgers Bus Schedule. ' + 'Say something like give me the next bus from x to y.';
var reprompt = "What are the bus stops that you are looking at?";
response.ask(output, reprompt);
}

ruBusTracker.prototype.intentHandlers = {
GetBusesByStopIntent: function(intent, session, response) {
    handleRequest(intent, response);
},

"AMAZON.HelpIntent": function(intent, session, response) {
    var speechOutput = 'Request bus timings from one stop to another inside the University campus. You could ask, "Get next buses from College Hall to Scott Hall."';
    var reprompt = "What are the bus stops that you are looking at?";
    response.ask(speechOutput, reprompt);
},

"AMAZON.StopIntent": function(intent, session, response) {
  response.tell("see ya!");
},

"AMAZON.CancelIntent": function(intent, session, response) {
  response.tell("see ya!");  
}
}

exports.handler = function(event, context) {
var skill = new ruBusTracker();
skill.execute(event, context);
}

var BUS_STOPS = [
"LIPMAN HALL",
"COLLEGE HALL",
"COLLEGE WHOLE",
"COLLEGE HOLE",
"BRAVO SUPERMARKET",
"HILL CENTER NORTH",
"HILL CENTER SOUTH",
"ALLISON ROAD CLASSROOMS",
"PUBLIC SAFETY BUILDING SOUTH",
"ROCKOFF HALL",
"RED OAK LANE",
"LIVINGSTON PLAZA",
"LIVINGSTON STUDENT CENTER",
"SCOTT HALL",
"SCOTT HOLE",
"SCOTT WHOLE",
"SCOTT HOME",
"SCOUT HOME",
"TRAIN STATION",
"PATERSON STREET",
"FOOD SCIENCES BUILDING",
"BIEL ROAD",
"HENDERSON",
"KATZENBACH",
"GIBBONS",
"PUBLIC SAFETY BUILDING NORTH",
"LIBERTY STREET",
"ZIMMERLI ARTS MUSEUM",
"STUDENT ACTIVITIES CENTER",
"STUDENT ACTIVITY CENTER",
"RUTGERS STUDENT CENTER",
"VISITOR CENTER",
"STADIUM",
"WERBLIN BACK ENTRANCE",
"SCIENCE BUILDING",
"LIBRARY OF SCIENCE",
"BUSCH SUITES",
"BUSCH CAMPUS CENTER",
"BUELL APARTMENTS",
"WERBLIN MAIN ENTRANCE",
"QUADS",
"DAVIDSON HALL",
"NURSING SCHOOL",
"COLONY HOUSE"
];