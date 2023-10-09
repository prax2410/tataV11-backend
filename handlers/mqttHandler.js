const fs = require('fs');
const Moment = require("moment");
const db = require("../Database/db");
const logger = require("../controllers/logger")
// with ssl
const https = require('https');
const io = require("socket.io")(https.createServer({
    key: fs.readFileSync('/etc/letsencrypt/live/tatapower.esys.co.in/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/tatapower.esys.co.in/fullchain.pem')
}).listen(3003), {
    cors: {
        origin: '*'
    }
});

// without ssl
// const io = require("socket.io")(3003, {
//     cors: {
//         origin: "*",
//     },
// });

// ----------MQTT----------
const mqtt = require('mqtt');
const path = require('path');

const configFile = path.join(__dirname, '../configHandlers/mqttConfig.json');
const mqttConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));

const { PORT, HOST, USERNAME, PASSWORD, PROTOCOL } = mqttConfig

const options = {
    port: PORT,
    host: HOST,
    username: USERNAME,
    password: PASSWORD,
    protocol: PROTOCOL
};

const client = mqtt.connect(options);

client.on('connect', function () {
    console.log("MQTT Connected");
    client.subscribe('TP/TMS/CBE', function (err) {
    });
});

const negatePower = (value) => {
    let newValue = parseFloat(value).toFixed(2)
    return Math.abs(newValue)
}

client.on('message', async function (topic, message) {
    try {
        const data = message.toString();
        const mqttData = JSON.parse(data);

        // Destructuring data for further use
        const {
            temperature1,
            temperature2,

            voltage1,
            voltage2,
            voltage3,
        
            V12,
            V23,
            V31,
        
            power1,

            current1,
            current2,
            current3,

            frequency,

            macid,
            wegid,

            BRKON,
            BRKOFF,
            BUCALM,
            SPRCHA,
            MOGTRP,
            WTIALM,
            OTIALM,
            PRVTRP,

            APMAXDEMAND,
            APMINDEMAND,
            RPMAXDEMAND,
            RPMINDEMAND,
            APPMAXDEMAND,
            IMPACTENERGY,
            EXPACTENERGY,
            TOTACTENERGY,
            IMPREAENERGY,
            EXPREAENERGY,
            TOTREAENERGY,
            TOTAPPENERGY,

            THDVR,
            THDVY,
            THDVB,
            THDCL1,
            THDCL2,
            THDCL3,
            ERRCODE,
		
            STRDB
        } = mqttData;

        
	
        // Socket streaming the data to frontend
        io.emit("recieve-temp", {
            data: {
                temperature_1: parseFloat(temperature1).toFixed(2),
                temperature_2: parseFloat(temperature2).toFixed(2),

                voltage_1: parseFloat(voltage1 / 1000).toFixed(2),
                voltage_2: parseFloat(voltage2 / 1000).toFixed(2),
                voltage_3: parseFloat(voltage3 / 1000).toFixed(2),

                v12: parseFloat(V12 / 1000).toFixed(2),
                v23: parseFloat(V23 / 1000).toFixed(2),
                v31: parseFloat(V31 / 1000).toFixed(2),
            
                power_1: negatePower(power1),

                current_1: parseFloat(current1).toFixed(2),
                current_2: parseFloat(current2).toFixed(2),
                current_3: parseFloat(current3).toFixed(2),

                frequency: parseFloat(frequency).toFixed(2),

                macid: macid,
                wegid: wegid,

                brk_on: BRKON,
                brk_off: BRKOFF,
                buc_alm: BUCALM,
                spr_cha: SPRCHA,
                mog_trp: MOGTRP,
                wti_alm: WTIALM,
                oti_alm: OTIALM,
                prv_trp: PRVTRP,
                thd_vr: THDVR,
                thd_vy: THDVY,
                thd_vb: THDVB,
                thd_cl1: THDCL1,
                thd_cl2: THDCL2,
                thd_cl3: THDCL3,
                err_code: ERRCODE,

                str_db: STRDB,
                last_data_sent_at: Moment(new Date()).format("DD/MM/YYYY h:mm:ss a")
            }
        });
	
        // Stores data into database
        checkTableList(wegid.toLowerCase())
            .then(tableExist => {
                if (tableExist) {
                    storeIntoDb(mqttData)
                } else {
                    return
                }
            })
    } catch (e) {
        return;
    }
});

client.on('close', function () {
    logger.log({
        level: 'error',
        message: 'Communication Down',
    });
})
// ----------MQTT----------

// -------------------------------------------------------------------------------------
// Check for the table in db
async function checkTableList(wegid) {
    try {
        const tables = await db.many(
            "SELECT table_name FROM information_schema.tables"
        );
        
        const checkForWegidTable = tables.filter(
            (name) => name.table_name === `${wegid}`
        );

        if (!checkForWegidTable[0]) return false;
        else return true;
    } catch (e) {
        return false;
    }
}
// -------------------------------------------------------------------------------------

// -------------------------------------------------------------------------------------
// Store into db
let wegidTimestamps = {};

async function storeIntoDb(data) {
    // Destructuring the data values
    const {
        temperature1,
        temperature2,

        voltage1,
        voltage2,
        voltage3,
        
        V12,
        V23,
        V31,
        
        power1,

        current1,
        current2,
        current3,

        frequency,

        macid,
        wegid,

        BRKON,
        BRKOFF,
        BUCALM,
        SPRCHA,
        MOGTRP,
        WTIALM,
        OTIALM,
        PRVTRP,

        APMAXDEMAND,
        APMINDEMAND,
        RPMAXDEMAND,
        RPMINDEMAND,
        APPMAXDEMAND,
        IMPACTENERGY,
        EXPACTENERGY,
        TOTACTENERGY,
        IMPREAENERGY,
        EXPREAENERGY,
        TOTREAENERGY,
        TOTAPPENERGY,

        THDVR,
        THDVY,
        THDVB,
        THDCL1,
        THDCL2,
        THDCL3,
        ERRCODE
    } = data;

    let currentTime = new Date().getTime();
    if (!wegidTimestamps[wegid] || (currentTime - wegidTimestamps[wegid]) >= 10 * 60 * 1000) {
        
        // Log voltage if error
        checkVoltage(V12, 'V12', wegid);
        checkVoltage(V23, 'V23', wegid);
        checkVoltage(V31, 'V31', wegid);
        // Log temperature if error
        checkTemperature(temperature1, 'oil', wegid);
        checkTemperature(temperature2, 'winding', wegid);
        // Log current if error
        checkCurrent(current1, current2, current3, wegid);
        // Log alarms if error
        checkAlarms(BRKON, BRKOFF, BUCALM, SPRCHA, MOGTRP, WTIALM, OTIALM, PRVTRP, wegid);

        await db.none(
            `INSERT INTO $1:name (
                    temperature_1,
                    temperature_2,
                    voltage_1,
                    voltage_2,
                    voltage_3,
                    V12,
                    V23,
                    V31,
                    current_1,
                    current_2,
                    current_3,
                    power_1,
                    frequency,
                    mac_address,
                    BRKON,
                    BRKOFF,
                    BUCALM,
                    SPRCHA,
                    MOGTRP,
                    WTIALM,
                    OTIALM,
                    PRVTRP,
                    THDVR,
                    THDVY,
                    THDVB,
                    THDCL1,
                    THDCL2,
                    THDCL3,
                    ERRCODE,
                    APMAXDEMAND,
                    APMINDEMAND,
                    RPMAXDEMAND,
                    RPMINDEMAND,
                    APPMAXDEMAND,
                    IMPACTENERGY,
                    EXPACTENERGY,
                    TOTACTENERGY,
                    IMPREAENERGY,
                    EXPREAENERGY,
                    TOTREAENERGY,
                    TOTAPPENERGY
                ) VALUES($2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42);`,
            [
                wegid.toLowerCase(),
                parseFloat(temperature1).toFixed(2),
                parseFloat(temperature2).toFixed(2),
                parseFloat(voltage1 / 1000).toFixed(2),
                parseFloat(voltage2 / 1000).toFixed(2),
                parseFloat(voltage3 / 1000).toFixed(2),
                parseFloat(V12 / 1000).toFixed(2),
                parseFloat(V23 / 1000).toFixed(2),
                parseFloat(V31 / 1000).toFixed(2),
                parseFloat(current1).toFixed(2),
                parseFloat(current2).toFixed(2),
                parseFloat(current3).toFixed(2),
                negatePower(power1),
                parseFloat(frequency).toFixed(2),
                macid,
                parseInt(BRKON),
                parseInt(BRKOFF),
                parseInt(BUCALM),
                parseInt(SPRCHA),
                parseInt(MOGTRP),
                parseInt(WTIALM),
                parseInt(OTIALM),
                parseInt(PRVTRP),
                parseInt(THDVR),
                parseInt(THDVY),
                parseInt(THDVB),
                parseInt(THDCL1),
                parseInt(THDCL2),
                parseInt(THDCL3),
                parseInt(ERRCODE),
                APMAXDEMAND,
                APMINDEMAND,
                RPMAXDEMAND,
                RPMINDEMAND,
                APPMAXDEMAND,
                IMPACTENERGY,
                EXPACTENERGY,
                TOTACTENERGY,
                IMPREAENERGY,
                EXPREAENERGY,
                TOTREAENERGY,
                TOTAPPENERGY
            ]
        );

        wegidTimestamps[wegid] = currentTime;
    }
}
// -------------------------------------------------------------------------------------

// -------------------------------------------------------------------------------------
// Error logging
// ================= Voltage Checks ===================
function checkVoltage(voltage, type, wegid) {
    const voltageLimits = {
        min: 30000,
        max: 35000
    };

    if (voltage < voltageLimits.min) {
        logger.log({
            level: 'error',
            message: `Voltage ${type} less than ${voltageLimits.min / 1000}KV.`,
            wegid: wegid,
            data: voltage
        });
    }

    if (voltage > voltageLimits.max) {
        logger.log({
            level: 'error',
            message: `Voltage ${type} Greater than ${voltageLimits.max / 1000}KV.`,
            wegid: wegid,
            data: voltage
        });
    }
}

// ================= Temperature Checks ===================
function checkTemperature(temperature, type, wegid) {
    const temperatureLimits = {
        oil: 65,
        winding: 65
    };

    if (temperature > temperatureLimits[type]) {
        logger.log({
            level: 'error',
            message: `${type} Temperature HIGH`,
            wegid: wegid,
            data: temperature
        });
    }
}

// ================= Current Checks ===================
function checkCurrent(current1, current2, current3, wegid) {
    if (
        (current1 === 0 && current2 > 0.35 && current3 > 0.35) ||
        (current2 === 0 && current1 > 0.35 && current3 > 0.35) ||
        (current3 === 0 && current1 > 0.35 && current2 > 0.35)) {
        logger.log({
            level: 'error',
            message: 'Phase Current Zero',
            wegid: wegid
        });
    }
}

// ================= Alarms Checks ===================
function checkAlarms(BRKON, BRKOFF, BUCALM, SPRCHA, MOGTRP, WTIALM, OTIALM, PRVTRP, wegid) {
    if (BRKON === 0) {
        logger.log({
            level: 'error',
            message: 'BRKON LOW',
            wegid: wegid,
            data: BRKON
        });
    }

    if (BRKOFF === 1) {
        logger.log({
            level: 'info',
            message: 'BRKOFF HIGH',
            wegid: wegid,
            data: BRKOFF
        });
    }

    if (BUCALM === 1) {
        logger.log({
            level: 'info',
            message: 'BUCTRP HIGH',
            wegid: wegid,
            data: BUCALM
        });
    }

    if (SPRCHA === 0) {
        logger.log({
            level: 'error',
            message: 'SP CRGD LOW',
            wegid: wegid,
            data: SPRCHA
        });
    }

    if (MOGTRP === 1) {
        logger.log({
            level: 'info',
            message: 'MOGALM HIGH',
            wegid: wegid,
            data: MOGTRP
        });
    }

    if (WTIALM === 1) {
        logger.log({
            level: 'info',
            message: 'WTIALM HIGH',
            wegid: wegid,
            data: WTIALM
        });
    }

    if (OTIALM === 1) {
        logger.log({
            level: 'info',
            message: 'OTIALM HIGH',
            wegid: wegid,
            data: OTIALM
        });
    }

    if (PRVTRP === 1) {
        logger.log({
            level: 'info',
            message: 'PRVTRP HIGH',
            wegid: wegid,
            data: PRVTRP
        });
    }
}
// -------------------------------------------------------------------------------------
