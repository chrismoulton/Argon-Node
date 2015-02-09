/*
    LICENSE: linkToLicense
*/
function Argon(url, onload) {

    if (typeof url !== "string")
        console.info("First parameter of Argon() object should be the url of the directory where Argon is stored (argon.php).")
    this.onload = onload;
    this.m = {};
    this.m.fixCallback = function(callback) {
        if (typeof callback !== "function")
            callback = function(rtrn) {
                console.log(rtrn);
            }
        return callback;
    }
    
    this.time = {};
    this.time.current = 0;
    this.time.DATA = {}; //data that is changed before a time is retrieved from server
    this.time.updater = undefined;
    this.time['sync speed'] = 5;

    this.time.dataUpdater = function(offset) { //syncs data (argon.time.DATA) that was modified before time was retrieved from server
        if (JSON.stringify(argon.time.DATA).length > 2) { //data has been changed
            for (key in argon.time.DATA)
                if (argon.time.DATA[key].time !== undefined)
                    argon.time.DATA[key].time = argon.time.DATA[key].time + offset;
            for (key in argon.time.DATA)
                argon.DATA[key] = argon.time.DATA[key];
            argon.ls.user.update(argon.time.DATA);
        }
    }
    this.time.get = function() {
        var req_time = 0;
        var time_interval = setInterval(function() {req_time++}, 2);
        argon.requests.add({
            'action': 'get time',
        }, function(date) {
            clearInterval(time_interval);
                date = date - req_time;
                argon.time.current = date;

                var date_obj = new Date();
                var cpu_time = date_obj.getMonth() + "/" + date_obj.getDate() + "/" + date_obj.getFullYear() + " " + date_obj.toLocaleTimeString();
                cpu_time = Date.parse(cpu_time);
                if (date > cpu_time) {
                    var offset = date - cpu_time; //date === server time
                } else if (date === cpu_time) {
                    var offset = 0;
                } else {
                    var offset = cpu_time - date; //date === server time
                }
                argon.time.dataUpdater(offset);
                clearInterval(argon.time.updater);
                argon.time.updater = setInterval(function() {argon.time.current += 80;}, 80);
        });
        if (argon.time.current === 0)
            argon.time.current = 1;
    };

    this.url = url;
    this.DATA = {};
    this.validate = {};

    this.validate.password = function(password) {
        var valid_chars = 'abcdefghijklmnopqrstuvwxyz1234567890.,?!';
        if (password.length > 5 && password.length < 20) {
            for (var i = 0; i < password.length; i++) {
                var isThere = false;
                for (var e = 0; e < valid_chars.length; e++) {
                    if (valid_chars[e] === password[i].toLowerCase())
                        isThere = true;
                }
                if (isThere === false)
                    return false;
            }
            return true;
        }
        return false;
    }
    this.validate.username = function(username) {
        var valid_chars = 'abcdefghijklmnopqrstuvwxyz1234567890_';
        if (username.length > 3 && username.length < 17) {
            for (var i = 0; i < username.length; i++) {
                var isThere = false;
                for (var e = 0; e < valid_chars.length; e++) {
                    if (valid_chars[e] === username[i].toLowerCase())
                        isThere = true;
                }
                if (isThere === false)
                    return false;
            }
            return true;
        }
        return false;
    }

    this.user = {};
    this.user.username = "default";
    this.requests = {};

    this.encode = function(obj) { //used to encode requests
        var strObj = JSON.stringify(obj);
        strObj = strObj.replace(/@/g, "%40");
        strObj = strObj.replace(/\//g, "%2F");
        strObj = strObj.replace(/\+/g, "%2B");
        strObj = strObj.replace(/`/g, "%27");
        strObj = strObj.replace(/&/g, "%26");
        obj = JSON.parse(strObj);
        return obj;
    }

    this.requests.busy = false; //set to true when a request is being sent
    this.requests.queue = {requests: [],callbacks: []};

    this.requests.send = function(requests) {
        callbacks = requests.callbacks;
        requests = requests.requests;

        if (argon.requests.busy === false && navigator.onLine === true) {
            var xmlhttp;
            xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = function() {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                    argon.requests.busy = false;
                    try {
                        var return_data = JSON.parse(xmlhttp.responseText);
                    } catch (err) {
                        var error = {
                            "argonError": "Server responded with error",
                            "raw": xmlhttp.responseText.replace(/\n/g, " ")
                        }
                        console.info(error);
                        //send error to callbacks
                        for (var i = 0; i < callbacks.length; i++)
                            callbacks[i](error);
                        return 0; //cancel function call
                    }
                    if (typeof return_data === "object") {
                        if (return_data['request code'] !== undefined)
                            argon.client.saveRqCode(return_data['request code']); //get request code for next request
                        if (return_data.clients !== undefined) {
                            for (client in return_data.clients) {
                                if (client === argon.client.id().substr(0,8)) {
                                    return_data.clients[client]['this device'] = true;
                                } else {
                                    return_data.clients[client]['this device'] = false;
                                }
                            }
                            argon.clients.list = return_data.clients;
                        }
                        if (return_data['sync speed'] !== undefined)
                            argon.time['sync speed'] = return_data['sync speed'];
                        if (return_data.requests !== undefined)
                            return_data = return_data.requests;
                    }
                    if (return_data instanceof Array) { //array === normal response
                        for (var i = 0; i < return_data.length; i++) {
                            callbacks[i](return_data[i]);
                        }
                    } else { //other === error
                        if (return_data === "Not authenticated") {
                            console.info({
                                argonError: "User authentication failed"
                            });
                            argon.user.logout(true);
                        }
                        for (var i = 0; i < callbacks.length; i++)
                            callbacks[i](return_data);
                    }
        
                }

            };

            var request_object = {
                'requests': requests,
                'username': argon.user.username,
                'client': {
                    'id': argon.client.id(),
                    'request code': argon.client.getRqCode()
                },
            };
            xmlhttp.open("POST", argon.url, true);
            xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xmlhttp.send("FROM_CLIENT=" + JSON.stringify(request_object));
            argon.requests.busy = true;
            //clear queue
            argon.requests.queue = {callbacks: [], requests: []};
        }
    };
    this.requests.sender = function() {
        if (argon.requests.busy === false && argon.requests.queue.requests.length > 0) {
            if (navigator.onLine === true)
                argon.requests.send(argon.requests.queue);
        }
    }

    /* + If changed, update spam-detector in php + */
    setInterval(this.requests.sender, 800);

    this.requests.add = function(request, callback) {
        callback = argon.m.fixCallback(callback);
        var request_valid = false;
        if (typeof request === "object" && request.action !== undefined)
            request_valid = true;
        if (request_valid === true) {
            argon.requests.queue.callbacks.push(callback);
            argon.requests.queue.requests.push(request);
            return true;
        } else {
            return false
        }
    };

    this.ls = {};
    this.ls.get = function() {
        var argonObject = localStorage.getItem('argonObject');
        if (argonObject === null || argonObject === "{}") {
            argonObject = {users: {},pools: {}};
            localStorage.setItem('argonObject', JSON.stringify(argonObject));
        } else {
            argonObject = JSON.parse(argonObject);
        }
        return argonObject;
    }
    this.ls.update = function(obj) {
        var argonObject = localStorage.getItem('argonObject');
        if (argonObject === null) {
            argonObject = {};
        } else {
            argonObject = JSON.parse(argonObject);
        }
        for (key in obj)
            argonObject[key] = obj[key];
        localStorage.setItem('argonObject', JSON.stringify(argonObject));
    }
    this.ls.set = function(obj) {
        var argonObject = localStorage.getItem('argonObject');
        if (argonObject === null) {
            argonObject = {};
        } else {
            argonObject = JSON.parse(argonObject);
        }
        argonObject = obj;
        localStorage.setItem('argonObject', JSON.stringify(argonObject));
    }

    this.ls.user = {};
    this.ls.user.update = function(obj) {
        var argonObject = argon.ls.get();
        argonObject.users[argon.user.username].data = argon.DATA;
        argon.ls.update(argonObject);
    };
    this.ls.last_sync = {}; //times of last successful sync of properties (used to only sync changes to server)
    this.ls.sync = function(callback) {

        if (navigator.onLine === false)
            return 0;
        var changes_obj = {}; //properties that have been changed since last sync
        for (key in argon.DATA) {
            if (argon.ls.last_sync[key] !== undefined) {
                if (argon.DATA[key].time > argon.ls.last_sync[key]) {
                    changes_obj[key] = argon.DATA[key];
                }
            } else {
                changes_obj[key] = argon.DATA[key];
            }
        }

        //update argon time on sync
        argon.time.get();

        argon.requests.add({
            'action': 'sync',
            'data':argon.encode(changes_obj),
            'last synced': argon.ls.last_sync
        }, function(d) {
            if (d.argonError === undefined) {
                if (typeof d !== "object")
                    d = {};
                for (key in d) { //merge changes with local DATA object
                    argon.DATA[key] = d[key];

                    if (d[key].data === null) { //remove null properties
                        delete argon.DATA[key];
                    }
                }

                //update localStorage again if received response from server
                if (argon.user.username !== "default") {
                    var argonObject = argon.ls.get();
                    if (argonObject.users[argon.user.username] !== undefined)
                        argonObject.users[argon.user.username].data = argon.DATA;
                    argon.ls.update(argonObject);
                }
            }
            if (callback !== undefined) {
                if (d.argonError === undefined) {
                    callback(true);
                } else {
                    callback(d);
                }
            }
            argon.ls.last_sync = {};
            for (key in argon.DATA) {
                argon.ls.last_sync[key] = argon.DATA[key].time;
            }
            //call onload method if is first sync
            if (argon.onload !== undefined) {
                if (typeof argon.onload === "function") {
                    argon.onload();
                    argon.onload = undefined;
                }
            }
        });

        //update localStorage initially with argon.DATA
        var argonObject = argon.ls.get();
        if (argonObject.users[argon.user.username] !== undefined) {
            argonObject.users[argon.user.username].data = argon.DATA;
        }
        argon.ls.update(argonObject);
    };

    this.ls.lastData = {};
    this.ls.lastSyncedInt = 0;
    this.ls.syncer = function() { //called by .setup() interval
        if (argon.user.username !== "default") {
            var alreadySynced = false;
            var usr_data = {}; //data modified by this client, so that any changes pushed from another client to this client are not synced back to the server.
            for (key in argon.DATA) {
                if (argon.DATA[key].changedBy === argon.client.name()) {
                    usr_data[key] = argon.DATA[key];
                }
            }
            var shouldSync = false;
            var lastData = {};
            try {
                lastData = JSON.parse(argon.ls.lastData);
            } catch(err) {
                lastData = {};
            }
            for (prop in usr_data) {
                if (lastData[prop] === undefined) {
                    shouldSync = true;
                } else if (JSON.stringify(lastData[prop]) !== JSON.stringify(usr_data[prop])) {
                    shouldSync = true;
                }
            }
            if (shouldSync === true) {
                argon.ls.lastData = JSON.stringify(usr_data);
                argon.ls.sync();
                alreadySynced = true;
            }
            
            argon.ls.lastSyncedInt++;

            if (alreadySynced === false) {
                if (argon.ls.lastSyncedInt === argon.time['sync speed']) {
                    argon.ls.sync();
                    argon.ls.lastSyncedInt = 0;
                }
            } else {
                argon.ls.lastSyncedInt = 0; //if already synced because of client data change, go ahead and wait another 7 seconds
            }
        }
    }
    this.sync = function() {
        argon.ls.sync();
        return {argonInfo: 'force sync initiated'};
    }
    this.user.get = function() {
        if (argon.user.username !== "default") {
            var returnObj = {};
            for (key in argon.DATA) {
                if (argon.DATA[key].data !== null) { //don't return data that has been set to *null* (meaning: been deleted)
                    if (argon.DATA[key].data !== undefined && argon.DATA[key].time !== undefined) {
                        returnObj[key] = argon.DATA[key].data;
                    } else {
                        returnObj[key] = argon.DATA[key];
                    }
                }
            }
            return returnObj;
        } else {
            return {
                argonError: "action not available for default user"
            };
        }
    }
    this.user.update = function(property, value) {
        var obj = {};
        obj[property] = value;
        if (argon.user.username !== "default") {
            if (argon.time.current < 100) {
                var date = new Date();
                var time = date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.toLocaleTimeString();
                time = Date.parse(time);
            } else {
                var time = argon.time.current;
            }
            if (argon.time.current === 1) { //data that is changed BEFORE a reliable time is retrieved from server
                for (key in obj) {
                    //assign data and time of creation
                    argon.time.DATA[key] = {
                        data: obj[key],
                        time: time,
                        changedBy: argon.client.name() //see sync checker
                    };
                }
            } else if (argon.time.current === 0) { //user is offline
                return {
                    argonInfo: "Error updating: unable to connect with time server."
                };
            } else {
                for (key in obj) {
                    //assign data and time of creation
                    argon.DATA[key] = {
                        data: obj[key],
                        time: time,
                        changedBy: argon.client.name()
                    };
                }
                argon.ls.user.update(argon.DATA);
            }
            return {
                argonInfo: "updated"
            };
        } else {
            return {
                argonError: "action not available for default user"
            };
        }
    }
    this.user.create = function(username, password, callback) {
        callback = argon.m.fixCallback(callback);
        if (argon.validate.password(password) === true) {
            if (argon.validate.username(username) === true) {
                username = username.toLowerCase();
                argon.requests.add({
                    'action': 'create user',
                    'username': username,
                    'password': password
                }, callback);
            } else {
                callback({
                    argonError: 'invalid username'
                })
            }
        } else {
            callback({
                argonError: 'invalid password'
            })
        }
    }
    this.user.login = function(username, password, callback) {
        callback = argon.m.fixCallback(callback);
        username = username.toLowerCase();
        if (argon.user.username === username) {
            callback({
                argonInfo: "Already logged in"
            });
            return 0;
        }
        if (argon.validate.password(password) === true) {
            if (argon.validate.username(username) === true) {

                var client_data = {};

                var argonObject = argon.ls.get();
                if (argonObject.users[username] !== undefined) {
                    client_data = argonObject.users[username].data;
                }
                argon.requests.add({
                    'action': 'login user',
                    'username': username,
                    'password': password,
                    'data': client_data
                }, function(data) {
                    if (data.argonError === undefined) {
                        argon.user.logout();
                        var argonObject = argon.ls.get();
                        if (argonObject.users[username] === undefined)
                            argonObject.users[username] = {};

                        argon.client.saveKey(data['client key']); //save new client key on login
                        argonObject.users[username].data = data.data;
                        argonObject.users[username].active = true;

                        argon.ls.update(argonObject);
                        argon.user.username = username;

                        argon.DATA = data.data;
                        callback({
                            argonInfo: 'successfully logged in'
                        });
                        console.info(argon.user.username);
                    } else {
                        callback(data);
                    }
                });
            } else {
                callback({
                    argonError: 'invalid username'
                })
            }
        } else {
            callback({
                argonError: 'invalid password'
            })
        }
    }
    this.user.password = function(newPassword, oldPassword, callback) {
        callback = argon.m.fixCallback(callback);
        if (argon.user.username !== "default") {
            if (argon.validate.password(newPassword) === true) {
                argon.requests.add({
                    'action': 'change user password',
                    'new password': newPassword,
                    'password': oldPassword
                }, callback);
            } else {
                callback({
                    argonError: 'invalid password'
                })
            }
        } else {
            return {
                argonError: "action not available for default user"
            };
        }
    }
    this.user.logout = function(keepUser) {
        if (argon.user.username !== "default") {
            var argonObject = argon.ls.get();
            if (argonObject.users[argon.user.username] !== undefined)
                argonObject.users[argon.user.username].active = false;
            if (keepUser !== true)
                delete argonObject.users[argon.user.username];
            argon.ls.set(argonObject);

            argon.user.username = "default";
            argon.DATA = {};
            return {
                argonInfo: 'logged out'
            }
        } else {
            return {
                argonError: "action not available for default user"
            };
        }
    }
    this.user.forget = function() {
        if (argon.user.username !== "default") {
            var argonObject = argon.ls.get();
            if (argonObject.users[argon.user.username] !== undefined) { //remove user from LS
                delete argonObject.users[argon.user.username];
            }
            argon.ls.set(argonObject);
            return {
                argonInfo: 'forgot user from localStorage'
            }
        }
    }
    this.user.remove = function(password, callback) {
        callback = argon.m.fixCallback(callback);
        if (argon.user.username !== "default") {
            argon.requests.add({
                'action': 'remove user',
                'password': password
            }, function(d) {
                if (d.argonError === undefined) {
                    argon.user.forget();

                    argon.user.username = "default";
                    argon.DATA = {};
                }
                callback(d);
            });
        } else {
            return {
                argonError: "action not available for default user"
            };
        }
    }
    this.clients = {};
    this.clients.list = [];
    this.clients.remove = function(clientName, password, callback) {
        callback = argon.m.fixCallback(callback);
        if (password === undefined)
            return callback({
                argonError: 'invalid password'
            });
        if (argon.user.username !== "default") {
            if (argon.validate.password(password) === true && password.length > 5) {
                if (argon.clients.list[clientName] !== undefined) {
                    argon.requests.add({
                        'action': 'deauth client',
                        'client name': clientName,
                        'password': password,
                    }, callback);
                } else {
                    callback({
                        argonError: 'client could not be found'
                    });
                }
            } else {
                callback({
                    argonError: 'invalid password'
                })
            }
        } else {
            return {
                argonError: "action not available for default user"
            };
        }
    }
    this.client = {};
    this.client.ls = {};
    this.client.ls.get = function() {
        var obj = {};
        var temp = localStorage.getItem('argonClient');
        if (temp !== null)
            obj = JSON.parse(temp);
        return obj;
    }
    this.client.ls.set = function(obj) {
        localStorage.setItem('argonClient', JSON.stringify(obj));
    }
    this.client.get = function() {
        if (argon.client.ls.get().data === undefined)
            return {};
        return argon.client.ls.get().data;
    }
    this.client.name = function() {
        var id = argon.client.id(); 
        return id.substr(0,8);
    }
    this.client.update = function(property, value) {
        var obj = {};
        obj[property] = value;
        var client_data = argon.client.ls.get();
        if (client_data.data === undefined)
            client_data.data = {};
        for (key in obj) {
            client_data.data[key] = obj[key];
            if (obj[key] === null)
                delete client_data.data[key];
        }
        argon.client.ls.set(client_data);
        return {
            argonInfo: "updated"
        };
    }
    this.client.randStr = function(length) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for( var i=0; i < length; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }
    this.client.makeID = function() {
        var base = argon.client.randStr(32); //base (inital)
        base += argon.client.randStr(32); //add the next 45 chars to base

        //make length random (by 40 characters)
        var rnd = Math.floor(Math.random() * 12);
        if (rnd !== 0)
            base += argon.client.randStr(rnd);
        var rnd2 = Math.floor(Math.random() * 12);
        var rnd3 = Math.floor(Math.random() * 12);
        rnd2 = rnd2 * rnd3;
        base+= rnd2;

        return base;
    }
    this.client.id = function() {
        var client_data = argon.client.ls.get();
        var id = client_data.id;
        if (id === undefined) {
            id = argon.client.makeID();
            client_data.id = id;
            argon.client.ls.set(client_data);
        }
        return id;
    }
    this.client.saveRqCode = function(rqCode) {
        var client_data = argon.client.ls.get();
        client_data.rqCode = rqCode;
        argon.client.ls.set(client_data);
        return true;
    }
    this.client.getRqCode = function() {
        var client_data = argon.client.ls.get();
        var rqCode = client_data.rqCode;
        if (rqCode === undefined)
            rqCode = "";
        return rqCode;
    }
    this.client.saveKey = function(keyStr) {
        var client_data = argon.client.ls.get();
        client_data.keyStr = keyStr;
        argon.client.ls.set(client_data);
        return true;
    }
    this.client.getKey = function() {
        var client_data = argon.client.ls.get();
        var keyStr = client_data.keyStr;
        if (keyStr === undefined)
            keyStr = "";
        return keyStr;
    }
    this.setup = function() {
        var argonObject = argon.ls.get();
        var users = argonObject.users;
        for (user in users) {
            if (users[user].active === true) {
                argon.user.username = user;
                // argon.DATA = users[user].data;
            }
        }
        var pools = argonObject.pools;
        for (pool in pools) {
            if (pools[pool].active === true) {
                argon.pool.name = pool;
                argon.pool.password = pools[pool].password;
            }
        }
        argon.time.get();
        if (argon.user.username !== "default") {
            argon.requests.add({
                'action': 'generate request code',
                'key': argon.client.getKey()
            }, function(response) {
                //once new request token is generated, begin syncing.
                setInterval(argon.ls.syncer, 800);
            });
            argon.ls.sync();
        } else {
            setInterval(argon.ls.syncer, 800);
        }
    }
    /*FOR DEV ARGON ONLY*/
    this.dev = {};
    this.dev.reset = function(userPass) {
        if (argon.user.username !== "default") {
            argon.user.remove(userPass, function(d) {
                server.user.logout();
                delete localStorage.argonObject;
                delete localStorage.argonClient;
                location.reload();
            });
        } else {
            delete localStorage.argonObject;
            delete localStorage.argonClient;
            location.reload();
        }
    }
    var argon = this;
    this.setup();
}