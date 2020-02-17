const WebSocket = require("ws");
const wss = new WebSocket.Server({
    port: 9081
});
const Jimp = require("jimp");
const fs = require("fs");
const YAML = require("yamljs");
const clc = require("cli-color");

console.log("App Started..");
process.title = `NowSniper™`;

let OPTIONS = YAML.parse(fs.readFileSync(`${__dirname}/options/options.yaml`, "utf8"));
console.log("Options Loaded:", OPTIONS);
console.log("\n\n"+clc.bgYellow.black("Waiting for webside.."));

let mem = {
    lastArtworkUrl: "",
    lastPlayingUpdate: Date.now(),
    nowBlank: false,
    thUpdated: 0
}

function writeFile(name, data, ext="txt") {
    fs.writeFileSync(`${__dirname}/content/${name}.${ext}`, data);
}

function getPlatform(hostname) {
    let platforms = {
        "open.spotify.com": "Spotify",
        "soundcloud.com": "SoundCloud"
    }
    return platforms[hostname.toLowerCase()];
}


wss.on("connection", (ws) => {
    console.log("\n\n"+clc.bgGreenBright.black("Webside connected!"));
    ws.on("message", (data) => {
        data = JSON.parse(data);
        if (OPTIONS.DEBUG_LOG_DATA) console.log(data);
        if (!data.data.isPlaying) return;
        mem.lastPlayingUpdate = Date.now();

        mem.thUpdated++;
        process.title = `NowSniper™ | ${mem.thUpdated}`;

        writeFile("current_data",JSON.stringify(data,null,4),"json");

        writeFile("platform",OPTIONS.PLATFORM_FORMAT.replace(/{i}/gm,getPlatform(data.hostname)))
        writeFile("title", OPTIONS.TITLE_FORMAT.replace(/{i}/gm,data.data.title));
        writeFile("artists", OPTIONS.ARTISTS_FORMAT.replace(/{i}/gmi,data.data.artist));

        writeFile("time_passed",data.data.timePassed);
        writeFile("total_duration",data.data.totalDuration);

        writeFile("custom_format",mapReplace(OPTIONS.CUSTOM_FILE_FORMAT,{
            "{t}":data.data.title,
            "{a}":data.data.artist,
            "{p}":getPlatform(data.hostname),
            "{tp}":data.data.timePassed,
            "{td}":data.data.totalDuration,
            "{nl}":"\n"
        }))

        if (mem.lastArtworkUrl != data.data.artwork) {
            Jimp.read({
                url: data.data.artwork
            }).then(artwork => {
                artwork.resize(500, 500)
                    .write(`${__dirname}/content/artwork.png`);
            })
            mem.lastArtworkUrl = data.data.artwork;
        }

        mem.nowBlank = false;

        let totalDurationSeconds = formattedDurationToSeconds(data.data.totalDuration);
        let timePassedSeconds = formattedDurationToSeconds(data.data.timePassed);
        let timePassedPercent = Math.round(rangeToPercent(timePassedSeconds,0,totalDurationSeconds)*100);

        drawProgressBar(timePassedPercent);

        
    });
});

setInterval(() => {
    if (mem.lastPlayingUpdate + 5000 < Date.now() && !mem.nowBlank) {
        mem.nowBlank = true;
        writeFile("platform", OPTIONS.PLATFORM_PAUSED_FORMAT);
        writeFile("title", OPTIONS.TITLE_PAUSED_FORMAT);
        writeFile("artists", OPTIONS.ARTISTS_PAUSED_FORMAT);
        writeFile("time_passed",OPTIONS.TIMEPASSED_PAUSED_FORMAT);
        writeFile("total_duration",OPTIONS.DURATION_PAUSED_FORMAT);

        drawProgressBar(0);

        if (OPTIONS.CHANGE_ARTWORK_WHEN_PAUSED) {
            mem.lastArtworkUrl = "";
            Jimp.read(`${__dirname}/options/paused.png`).then(artwork => {
                artwork.resize(500, 500)
                    .write(`${__dirname}/content/artwork.png`);
            });
        }
    }

    OPTIONS = YAML.parse(fs.readFileSync(`${__dirname}/options/options.yaml`, "utf8"));
}, 4000);


function drawProgressBar(percent=0) {
    new Jimp(100,1,Jimp.cssColorToHex(OPTIONS.PROGRESS_BAR_COLOR),(err, image)=>{
        if (err) return console.log(err);

        for (let index = 0; index < percent; index++) {
            image.setPixelColor(Jimp.cssColorToHex(OPTIONS.PROGRESS_BAR_LOADED_COLOR),index,1);
        }

        image.resize(500,10,Jimp.RESIZE_NEAREST_NEIGHBOR);
        image.write(`${__dirname}/content/progress_bar.png`);
        
    });
}

function formattedDurationToSeconds(formatted="00:00"){
    let totalSeconds = 0;
    let splited = formatted.split(":");
    if (splited.length == 2) {
        totalSeconds += parseInt(splited[1]);
        totalSeconds += Math.floor(parseInt(splited[0])*60);
    } else if (splited.length == 3) {
        totalSeconds += parseInt(splited[2]);
        totalSeconds += Math.floor(parseInt(splited[1])*60);
        totalSeconds += Math.floor(parseInt(splited[0])*60*60);
    }
    return totalSeconds;
}

//https://stackoverflow.com/a/18674180
function mapReplace(text,map) {
    var regex = [];
    for(var key in map)
        regex.push(key.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"));
    return text.replace(new RegExp(regex.join('|'),"g"),function(word){
        return map[word];
    });
};

//https://stackoverflow.com/a/16887307
function rangeToPercent(number, min, max){
    return ((number - min) / (max - min));
}

//https://stackoverflow.com/a/14032965
process.on('exit', ()=>{beforeExit()});
process.on('SIGINT', ()=>{beforeExit()});

function beforeExit() {
    fs.readdirSync(`${__dirname}/content/`).forEach((fileName)=>{
        try {fs.unlinkSync(`${__dirname}/content/${fileName}`);} catch {;};
    });

    process.exit();
};