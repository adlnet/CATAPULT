/*
    Copyright 2021 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
"use strict";

const Boom = require("@hapi/boom"), 
    Wreck = require("@hapi/wreck"),   
    { v4: uuidv4 } = require("uuid"); 

let Session; 

module.exports = Session = {
    
    load: async (sessionId, tenantId, {db}) => {
        try {
            return await Session.getSession(sessionId, db);
        }   catch (ex) {
                throw new Error(`Failed to select session: ${ex}`);
        }
    },

    getSession: async(sessionId, db) => {
        return await db
            .first("*")
            .from("sessions")
            .where(builder => {
                builder
                        .where("sessions.id", sessionId)
                        .orWhere("sessions.code", sessionId.toString()
                    );
            })
            .queryContext({jsonCols: ["context_template"]});
    },

    loadForChange: async (txn, sessionId, tenantId) => {
        
        let queryResult = await Session.tryGetQueryResult(txn, sessionId, tenantId);
        
        if (! queryResult) {
            await txn.rollback();
            throw Boom.notFound(`session: ${sessionId}`);
        }

        const {
            sessions: session,
            registrationsCoursesAus: regCourseAu,
            registrations: registration,
            coursesAus: courseAu
        } = queryResult;

       // console.log(courseAu);
       // console.log("In loadForChange session is ", session);
        //this seems to be what is causing the trouble, here it doesn't know what to do
        regCourseAu.courseAu = courseAu;
       // console.log("In loadForChange adter 'courseAu' assignment session is ", session);
        return {session, regCourseAu, registration, courseAu};
    },

    tryGetQueryResult: async(txn, sessionId, tenantId) => { 
        try {
            return await Session.getQueryResult(txn, sessionId, tenantId);
            
        }
        catch (ex) {
            await txn.rollback();
            throw new Error(`Failed to select session, registration course AU, registration and course AU for update: ${ex}`);
        }
    },

    getQueryResult: async(txn, sessionId, tenantId) => {
        return await txn
            .first("*")
            .from("sessions")
            .leftJoin("registrations_courses_aus", "sessions.registrations_courses_aus_id", "registrations_courses_aus.id")
            .leftJoin("registrations", "registrations_courses_aus.registration_id", "registrations.id")
            .leftJoin("courses_aus", "registrations_courses_aus.course_au_id", "courses_aus.id")
            .where({"sessions.tenant_id": tenantId})
            .andWhere( finder => {
                finder
                    .where("sessions.id", sessionId)
                    .orWhere("sessions.code", sessionId.toString());
                    })
            .queryContext({
                jsonCols: [
                    "registrations_courses_aus.metadata",
                    "registrations.actor",
                    "registrations.metadata",
                    "courses_aus.metadata",
                    "sessions.context_template"
                ]
            })
            .forUpdate()
            .options({nestTables: true});
    },

    abandon: async (sessionId, tenantId, by, {db, lrsWreck}) => {
        const txn = await db.transaction(); 
        
        let session,
            regCourseAu,
            registration,
            courseAu;

       // console.log("In abandon, right at begining session is :", session)
        try {
            ({
                session,
                regCourseAu,
                registration,
                courseAu
            } = await Session.loadForChange(txn, sessionId, tenantId));
        }
        catch (ex) {
            await txn.rollback();
            throw Boom.internal(ex);
        }

        let stResponse,
            stResponseBody;

       // console.log("In abandon session is ", session);
        
        if (session.is_terminated) {
            //
            // it's possible that a session gets terminated in between the time
            // that the check for open sessions occurs and getting here to
            // abandon it, but in the case that a terminated happens in that time
            // then there is no reason to abandon the session so just return
            //
            await txn.rollback();

            return;
        }
        if (session.is_abandoned) {
            //
            // shouldn't be possible to get here, but if it were to occur there
            // isn't really a reason to error, better to just return and it is
            // expected that more than one abandoned would not be recorded
            //
            await txn.rollback();

            return;
        }

        
        let durationSeconds = Session.initializeDuration(session);
        

        stResponse = await Session.retrieveResponse(durationSeconds, session, regCourseAu, registration, lrsWreck, txn);
        
       // console.log("after func checkStatusCode stResponse is ", stResponse);

        await Session.checkStatusCode(txn, stResponse, stResponseBody);
    
        Session.txnUpdate(txn, by);

        await txn.commit();
    },

    tryGetSessionInfo: async (txn, sessionId, tenantId) =>{
        try {   
            return await Session.loadForChange(txn, sessionId, tenantId);        
        }
        catch (ex) {
            await txn.rollback();
            throw Boom.internal(ex);
        }
    },

    initializeDuration(session) {
        let durationSeconds
        if (session.is_initialized) {
            durationSeconds = (new Date().getTime() - session.initialized_at.getTime()) / 1000;
        }
    },

    determineSessionValid: async (session) => {
        switch(session) {
          
            case (session.is_terminated):
                //
                // it's possible that a session gets terminated in between the time
                // that the check for open sessions occurs and getting here to
                // abandon it, but in the case that a terminated happens in that time
                // then there is no reason to abandon the session so just return
                //
                await txn.rollback();
                return false;
        
            case (session.is_abandoned): 
                //
                // shouldn't be possible to get here, but if it were to occur there
                // isn't really a reason to error, better to just return and it is
                // expected that more than one abandoned would not be recorded
                //
                await txn.rollback();
                return false;
            default:
                return true;

        }
    },
    
    retrieveResponse: async (durationSeconds, session, regCourseAu, registration, lrsWreck, txn) => {
        let stResponse,
            stResponseBody

        try { stResponse = await lrsWreck.request(
            "POST",
            "statements",
            {
                headers: {
                    "Content-Type": "application/json"
                },
                payload: {
                    id: uuidv4(),
                    timestamp: new Date().toISOString(),
                    actor: registration.actor,
                    verb: {
                        id: "https://w3id.org/xapi/adl/verbs/abandoned",
                        display: {
                            en: "abandoned"
                        }
                    },
                    object: {
                        id: regCourseAu.courseAu.lms_id
                    },
                    result: {
                        duration: `PT${durationSeconds}S`
                    },
                    context: {
                        registration: registration.code,
                        extensions: {
                            "https://w3id.org/xapi/cmi5/context/extensions/sessionid": session.code
                        },
                        contextActivities: {
                            category: [
                                {
                                    id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                                }
                            ]
                        }
                    }
                }
            }
        ),

        stResponseBody = await Wreck.read(stResponse, {json: true})
        //console.log("In func retrieveResponse stResponse id ", stResponse);

        return [stResponse, stResponseBody];
        
        } catch (ex) {
            await txn.rollback();
            throw Boom.internal(new Error(`Failed request to store abandoned statement: ${ex}`));
        }

    },

checkStatusCode: async(txn, stResponse, stResponseBody) => {
   // console.log("In func checkStatusCode stResponse id ", stResponse);

    if (stResponse.statusCode !== 200) {
        await txn.rollback();
        throw Boom.internal(new Error(`Failed to store abandoned statement (${stResponse.statusCode}): ${stResponseBody}`));
    }
},

txnUpdate: async(txn, by) => {
    try {
        await txn("sessions").update({is_abandoned: true, abandoned_by: by}).where({id: session.id, tenantId});
    }
    catch (ex) {
        await txn.rollback();
        throw Boom.internal(`Failed to update session: ${ex}`);
    }
}
    
};
