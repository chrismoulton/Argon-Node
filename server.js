
/****

    { ARGON |NODE| }
    This is an expirimental release. Some features, including pools, are not available.
    There will be bugs.

    - @loadFive

****/

var dev_stats = {
    totalRequests: 0,
    users: 0
}

var fs = require('fs');
var http = require('http');
var url = require('url');

var openFile = function(path) {
    if (fs.existsSync(path)) {
        var file_contents = fs.readFileSync(path);
        try {
            file_contents = JSON.parse(file_contents);
        } catch(err) {
            console.error(err);
        }
        return file_contents;
    } else {
        return false;
    }
}
var validateUsername = function(username) {
    var valid_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_';
    if (username.length > 3) {
        for (var i = 0; i < username.lenght; i++) {
            var isThere = false;
            for (var e = 0; e < valid_chars.length; e++) {
                if (valid_chars[e] === username[i]) {
                    isThere = true;
                }
            }
            if (isThere === false) {
                return false;
            }
        }
        return true;
    }
    return false;
}
var validatePassword = function(password) {
    var valid_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,?!-';
    if (password.length > 5) {
        for (var i = 0; i < password.lenght; i++) {
            var isThere = false;
            for (var e = 0; e < valid_chars.length; e++) {
                if (valid_chars[e] === password[i]) {
                    isThere = true;
                }
            }
            if (isThere === false) {
                return false;
            }
        }
        return true;
    }
    return false;
}
var createDirectory = function(path) {
    if (fs.existsSync(path) === false) {
        fs.mkdirSync(path);
        return true;
    } else {
        return false;
    }
}
var generateRandStr = function(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < length; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
var saveFile = function(path, data) {
    try {
        fs.writeFileSync(path, JSON.stringify(data));
        return true;
    } catch(err) {
        return false;
    }
}
var getTime = function() {
    var date_obj = new Date();
    var cpu_time = date_obj.getMonth() + "/" + date_obj.getDate() + "/" + date_obj.getFullYear() + " " + date_obj.toLocaleTimeString();
    cpu_time = Date.parse(cpu_time);
    return cpu_time;
}
if (!(fs.existsSync('database/'))) {
    fs.mkdirSync('database/');
}
if (!(fs.existsSync('database/database.json'))) {
    saveFile('database/database.json', {});
}

var database = openFile('database/database.json');

var last_database = {};
setInterval(function() {
    console.log('\n\n~~~ Looking for changes ~~~');
    setTimeout(function() {
        if (JSON.stringify(last_database) !== JSON.stringify(database)) {
            saveFile('database/database.json', database);
            console.log('\n    | DATA SAVED TO DATABASE |');
            last_database = database;
        }
    },600);
},8000);


function Request(request, ip) {
    this.CLIENT_ID = request.client.id;
    this.username = request.username;
    this.password = request.password;
    this.REQUEST_CODE = request.client['request code'];
    this.requests = request.requests;
    this.ip = ip;


    this.action_allowed = function(action,auth_state) {
        var username = that.username;
        //by config.json
        var config_allowed = true;
        var config = {};
        config['*'] = {};
        if (fs.existsSync('database/config.json'))
            config = openFile('database/config.json');

        for (user in config) {
            if (user === "*" || user === username) {
                for (aName in config[user]) {
                    if (aName === action || aName === "*") {
                        config_allowed = config[user][aName];
                    }
                }
            }
        }
        //by auth state
        var allowed_default_actions = ["create user", "login user","get pool","update pool","join pool", "get time"];
        var allowed_nonRQSTCODE_actions = ["generate request code"];
        var is_allowed = false;
        if (auth_state === 2) {
            for (var i = 0; i < allowed_default_actions.length; i++) {
                if (allowed_default_actions[i] === action) {
                    is_allowed = true;
                }
            }
        } else if (auth_state === 3) {
            for (var i = 0; i < allowed_nonRQSTCODE_actions.length; i++) {
                if (allowed_nonRQSTCODE_actions[i] === action) {
                    is_allowed = true;
                }
            }
        } else {
            is_allowed = true;
        }
        if (config_allowed === true && is_allowed === true) {
            return true;
        } else {
            return false;
        }
    }

    this.auth = function() { // 0 = "not authed" / 1 = "authed" / 2 = "does not exist"
        var authed = 0;
        if (database[that.username] !== undefined) {
            if (database[that.username].clients === undefined)
                database[that.username].clients = {};

            var devicesOnline = 0;
            for (client in database[that.username].clients) {
                var currentTime = getTime();
                if (currentTime < database[that.username].clients[client]['last seen'] + 10000) { //if client has sent a request to the server within 10 seconds
                    devicesOnline++;
                }
            }
            if (database[that.username].clients[that.CLIENT_ID] !== undefined) {
                if (database[that.username].clients[that.CLIENT_ID].ip === that.ip) {
                    if (database[that.username].clients[that.CLIENT_ID]['request code'] === that.REQUEST_CODE) {
                        if (devicesOnline <= 5) {
                            currentTime = getTime();
                            if (currentTime - database[that.username].clients[that.CLIENT_ID]['last seen'] > 600) {
                                if (that.requests.length < 21) {
                                    authed = 1;
                                } else {
                                    authed = -3; //drop request (request spamming)
                                }
                            } else {
                                authed = -1; //too many requests by client
                            }
                        }
                    } else {
                        if (that.requests[0]['action'] === "generate request code") { //if request is trying to generate new request code
                            authed = 3; //generate requestCode
                        } else { //otherwise, because request code is incorrect, deauthenticate.
                            authed = 0;
                        }
                    }
                }
            }
        } else if (that.username === 'default') {
            authed = 2;
        } else {
            authed = 0;
        }

        return authed;
    }

    this.run = function() {

        //*** VALIDATE HERE ***//
        var validationSuccess = true;

        var authed = that.auth();
        var actions = that.actions;

        if (authed > 0 && validationSuccess === true) {
        var RETURN = {};
        RETURN['requests'] = [];


        if (authed === 1) {
            //AWARE
            RETURN['clients'] = {};
            if (database[that.username].clients === undefined) {
                database[that.username].clients = {};
            }
            database[that.username].clients[that.CLIENT_ID]['last seen'] = getTime();
            var devices_online = 0;
            for (id in database[that.username].clients) {
                var client = database[that.username].clients[id];

                var current_time = getTime();
                if (current_time - 19000 > client['last seen']) { //if client has not sent a request to the server in over 17 seconds
                    database[that.username].clients[id]['online'] = false;
                } else {
                    database[that.username].clients[id]['online'] = true;
                    devices_online++;
                }
                if (client['last seen'] + 1296000000 < getTime()) { //remove client if has not been used for more than 15 days
                    delete database[that.username].clients[id];
                }
            }
            var return_array = {};
            for (id in database[that.username].clients) {
                var Cobj = database[that.username].clients[id];
                // delete Cobj['request code'];
                delete Cobj['key'];
                return_array[id.substr(0, 8)] = Cobj;
            }

            RETURN['clients'] = return_array;
            var CLIENTS_LIST = return_array;

            if (devices_online > 1) {
                RETURN['sync speed'] = 5;
            } else {
                RETURN['sync speed'] = 15;
            }

            //REQUEST CODE
            RETURN['request code'] = '';
            //generate code for next request
            var t_CODE = generateRandStr(24);
            RETURN['request code'] = t_CODE;
            if (database[that.username].clients === undefined) {
                database[that.username].clients = {};
            }

            var already_present = false; //if user has already been logged in from ip
            for (id in database[that.username].clients) {
                if (that.CLIENT_ID === id) {
                    already_present = true;
                }
            }
            database[that.username].clients[that.CLIENT_ID]['request code'] = t_CODE;
        }

        for (var r = 0; r < that.requests.length; r++) {
            var REQUEST = that.requests[r];
            if (REQUEST['action'] === "create user" && that.action_allowed(REQUEST['action'],authed)) {
                var username = REQUEST['username'];
                var password = REQUEST['password'];
                if (validateUsername(username) === true && validatePassword(password) === true) {
                    if (database[username] === undefined) {
                        database[username] = {
                            password: password,
                            'creation date': getTime()
                        };

                        RETURN['requests'][r] = {'argonInfo':'user created'};
                    } else {
                        RETURN['requests'][r] = {"argonError":"user already exists"};
                    }
                } else {
                    RETURN['requests'][r] = {"argonError":"invalid username or password"};
                }
            } else if (REQUEST['action'] === "login user" && that.action_allowed(REQUEST['action'],authed)) {
                var username = REQUEST['username'];
                var password = REQUEST['password'];
                if (validateUsername(username) === true && validatePassword(password) === true) {
                    if (database[username] !== undefined) {
                        if (password === database[username].password) {
                            var user_data = database[username].data;
                            if (user_data === undefined) {
                                user_data = {};
                                user_data.argonInfo = {"data":true,"time":0};
                            }
                            var client_data = {};
                            if (REQUEST['data'] !== undefined) {
                                client_data = REQUEST['data'];
                            }
                            for (pName in client_data) {
                                if (user_data[pName] !== undefined) {
                                    if (client_data[pName].time >= user_data[pName].time) {
                                        user_data[pName] = client_data[pName];
                                    }
                                } else {
                                    user_data[pName] = client_data[pName];
                                }
                            }

                            //add client ip and id to login log of user
                            if (database[username].clients === undefined)
                                database[username].clients = {};

                            var already_present = false; //if user has already been logged in from ip
                            for (id in database[username].clients) {
                                if (that.CLIENT_ID === id) {
                                    already_present = true;
                                }
                            }

                            var devices_online = 0;
                            for (id in database[username].clients) {
                                var current_time = getTime();
                                if (database[username].clients[id]['last seen'] !== undefined) {
                                    if (current_time < database[username].clients[id]['last seen'] + 10000) { //if client has not sent a request to the server in over 9 seconds
                                        devices_online++;
                                    }
                                }
                            }

                            var tooManyClients = false;
                            if (devices_online > 2) {
                                tooManyClients = true;
                            }

                            var t_CODE = generateRandStr(24);
                            if (already_present !== true) {
                                database[username].clients[that.CLIENT_ID] = {};
                            }

                            database[username].clients[that.CLIENT_ID]['ip'] = that.ip;
                            database[username].clients[that.CLIENT_ID]['request code'] = t_CODE;

                            database[username].clients[that.CLIENT_ID]['key'] = generateRandStr(64);

                            database[username].clients[that.CLIENT_ID]['last seen'] = getTime();

                            RETURN['request code'] = t_CODE;

                            var return_array = {};
                            return_array['data'] = user_data;
                            return_array['client key'] = database[username].clients[that.CLIENT_ID].key;
                            if (tooManyClients === false) {
                                RETURN['requests'][r] = return_array;
                            } else {
                                RETURN['requests'][r] = {"argonError":"too many clients online"};
                            }
                        } else {
                            RETURN['requests'][r] = {"argonError":"password incorrect"};
                        }
                    } else {
                        RETURN['requests'][r] = {"argonError":"user does not exist"};
                    }
                } else {
                    RETURN['requests'][r] = {"argonError":"invalid username or password"};
                }
            } else if (REQUEST['action'] === "sync" && that.action_allowed(REQUEST['action'],authed)) {

                var last_synced = REQUEST['last synced'];

                var USER_DATA = database[that.username].data;
                if (USER_DATA === undefined) {
                    USER_DATA = {
                        argonInfo: true,
                    };
                }
                var client_data = REQUEST['data'];
                if (client_data === undefined) {
                    client_data = {};
                }
                for (pName in client_data) {
                    if (USER_DATA[pName] !== undefined) {
                        if (client_data[pName].time >= USER_DATA[pName].time) {
                            USER_DATA[pName] = client_data[pName];
                        }
                    } else {
                        USER_DATA[pName] = client_data[pName];
                    }
                }

                var changed_data = {};
                changed_data['argonInfo'] = {"data":true,"time":0};
                for (property in USER_DATA) {
                    if (last_synced[property] !== undefined) {
                        if (USER_DATA[property]['time'] > last_synced[property]) {
                            changed_data[property] = USER_DATA[property];
                        }
                    } else {
                        changed_data[property] = USER_DATA[property];
                    }

                    if (USER_DATA[property]['data'] === undefined) { //remove property if every client has been synced update to property
                        var can_remove = true;
                        for (client in CLIENTS_LIST) {
                            if (CLIENTS_LIST[client]['last seen'] < USER_DATA[property]['time']) {
                                can_remove = false;
                            }
                        }
                        if (can_remove === true) {
                            delete USER_DATA[property];
                        }
                    }
                }

                if (USER_DATA === undefined) {
                    USER_DATA = {};
                    USER_DATA['argonInfo'] = {"data":true,"time":0};
                }
                database[that.username].data = USER_DATA;
                RETURN['requests'][r] = changed_data; //sync only changes to client

            } else if (REQUEST['action'] === "remove user" && that.action_allowed(REQUEST['action'],authed)) {
                var password = "";
                if (REQUEST['password'] !== undefined)
                    password = REQUEST['password'];

                if (password === database[that.username].password) {
                    delete database[that.username];
                    RETURN['requests'][r] = {"argonInfo":"removed user"};
                } else {
                    RETURN['requests'][r] = {"argonError":"user password incorrect"};
                }
            } else if (REQUEST['action'] === "get time" && that.action_allowed(REQUEST['action'],authed)) {
                RETURN['requests'][r] = getTime();
            } else if (REQUEST['action'] === "generate request code" && that.action_allowed(REQUEST['action'],authed)) {
                var key = "";
                if (REQUEST['key'] !== false) {
                    key = REQUEST['key'];
                }
                var t_CODE = generateRandStr(24);
                if (database[that.username].clients === undefined)
                    database[that.username].clients = {};
                var client_key = database[that.username].clients[that.CLIENT_ID]['key'];

                if (client_key === key) {
                    database[that.username].clients[that.CLIENT_ID]['request code'] = t_CODE;

                    RETURN['request code'] = t_CODE; //send request code to client
                    RETURN['requests'][r] = {"argonInfo":"correct"};
                } else {
                    RETURN['requests'][r] = {"argonError":"nope"};
                }
            } else if (REQUEST['action'] === "change user password" && that.action_allowed(REQUEST['action'],authed)) {

                var password = REQUEST['password'];
                var new_password = REQUEST['new password'];

                if (password === database[that.username].password) {
                    if (validatePassword(new_password) === true) {
                        database[that.username].password = new_password;
                        RETURN['requests'][r] = {"argonInfo":"changed user password"};
                    } else {
                        RETURN['requests'][r] = {"argonError":"invalid user password"};
                    }
                } else {
                    RETURN['requests'][r] = {"argonError":"user password incorrect"};
                }

            // } else if (REQUEST['action'] === "get pool" && that.action_allowed(REQUEST['action'],authed)) { // POOLS * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
            //     $name = REQUEST['name'];
            //     $password = REQUEST['password'];
            //     if (file_exists("$directory/pools/$name.json")) {
            //         if (openFile("$directory/pools/$name.json","password") === $password) {
            //
            //             $permissions = openFile("$directory/pools/$name.json",'permissions');
            //             $owner = openFile("$directory/pools/$name.json",'owner');
            //
            //             if (is_allowed("get properties",$USERNAME, $permissions) || $owner === $USERNAME) { //permission: "get properties"
            //                 $return_val = openFile("$directory/pools/$name.json",'data');
            //                 $properties = REQUEST['properties'];
            //                 if ($return_val === null) {
            //                     $return_val = array();
            //                     $return_val['argonInfo'] = true;
            //                 }
            //
            //                 $final_return = array(); //contains only properties listed in array
            //                 $final_return['argonInfo'] = true;
            //
            //                 for ($i = 0; $i < count($properties); $i++) { //loop through requested properties
            //                     if (array_key_exists($properties[$i], $return_val)) {
            //                         $final_return[$properties[$i]] = $return_val[$properties[$i]];
            //                     }
            //                 }
            //
            //                 RETURN['requests'][r] = $final_return;
            //             } else {
            //                 RETURN['requests'][r] = json_decode('{"argonError":"action not allowed"}');
            //             }
            //         } else {
            //             RETURN['requests'][r] = json_decode('{"argonError":"pool not authenticated"}');
            //         }
            //     } else {
            //         RETURN['requests'][r] = json_decode('{"argonError":"pool does not exist"}');
            //     }
            } else if (REQUEST['action'] === "deauth client" && that.action_allowed(REQUEST['action'],authed)) {

                var password = REQUEST['password'];
                var client_name = REQUEST['client name'];

                if (password === database[that.username].password) {
                    var client_removed = false;
                    for (client_key in database[that.username].clients) {
                        var cname = client_key.substr(0, 8);
                        if (cname === client_name) {
                            if (client_key === that.CLIENT_ID) { //don't allow clients to remove themselves
                                client_removed = 1;
                            } else {
                                delete database[that.username].clients[client_key];
                                client_removed = true;
                            }
                        }
                    }

                    if (client_removed === true) {
                        RETURN['requests'][r] = {"argonInfo":"removed client"};
                    } else if (client_removed === false) {
                        RETURN['requests'][r] = {"argonInfo":"client could not be found"};
                    } else if (client_removed === 1) {
                        RETURN['requests'][r] = {"argonInfo":"current client cannot be removed"};
                    }
                } else {
                    RETURN['requests'][r] = {"argonError":"user password incorrect"};
                }

            // } else if (REQUEST['action'] === "update pool" && that.action_allowed(REQUEST['action'],authed)) {
            //     $name = REQUEST['name'];
            //     $password = REQUEST['password'];
            //     if (file_exists("$directory/pools/$name.json")) {
            //         if (openFile("$directory/pools/$name.json","password") === $password) {
            //
            //             $permissions = openFile("$directory/pools/$name.json",'permissions');
            //             $owner = openFile("$directory/pools/$name.json",'owner');
            //
            //             if (is_allowed("update properties",$USERNAME,$permissions) || $owner === $USERNAME) { //permission: "update properties"
            //                 //*** ACTION ***
            //                 $data = REQUEST['data'];
            //                 $pool_data = openFile("$directory/pools/$name.json",'data');
            //                 if ($pool_data === null) {
            //                     $pool_data = array();
            //                 }
            //                 foreach ($data as $opName => $opData) {
            //                     if ($opData !== null) {
            //                         if (array_key_exists($opName,$pool_data)) {
            //                             if (is_allowed("change properties",$USERNAME,$permissions) || $owner === $USERNAME) { //permission: "change properties"
            //                                 $pool_data[$opName] = $opData;
            //                             }
            //                         } else {
            //                             $pool_data[$opName] = $opData;
            //                         }
            //                     } else {
            //                         if (is_allowed("remove properties",$USERNAME,$permissions) || $owner === $USERNAME) { //permissions "remove properties"
            //                             if (array_key_exists($opName,$pool_data)) {
            //                                 $pool_data[$opName] = $opData;
            //                             }
            //                         }
            //                     }
            //                 }
            //                 saveFile("$directory/pools/$name.json",$pool_data,'data');
            //                 RETURN['requests'][r] = json_decode('{"argonInfo":"updated"}');
            //                 //*** ACTION ***
            //             } else {
            //                 RETURN['requests'][r] = json_decode('{"argonError":"action not allowed"}');
            //             }
            //         } else {
            //             RETURN['requests'][r] = json_decode('{"argonError":"pool not authenticated"}');
            //         }
            //     } else {
            //         RETURN['requests'][r] = json_decode('{"argonError":"pool does not exist"}');
            //     }
            // } else if (REQUEST['action'] === "create pool" && that.action_allowed(REQUEST['action'],authed)) {
            //     $name = REQUEST['name'];
            //     $password = REQUEST['password'];
            //     if (validateUsername($name) === true && validatePassword($password) === true) {
            //         if (file_exists("$directory/pools/$name.json") === false) {
            //
            //             //*** ACTION ***
            //             saveFile("$directory/pools/$name.json","{}");
            //             saveFile("$directory/pools/$name.json",$password,"password");
            //             saveFile("$directory/pools/$name.json",$USERNAME,"owner");
            //             RETURN['requests'][r] = json_decode('{"argonInfo":"pool created"}');
            //             //*** ACTION ***
            //
            //         } else {
            //             RETURN['requests'][r] = json_decode('{"argonError":"pool already exists"}');
            //         }
            //     } else {
            //         RETURN['requests'][r] = json_decode('{"argonError":"invalid name or password"}');
            //     }
            // } else if (REQUEST['action'] === "join pool" && that.action_allowed(REQUEST['action'],authed)) {
            //     $name = REQUEST['name'];
            //     $password = REQUEST['password'];
            //     if (validateUsername($name) === true && validatePassword($password) === true) {
            //         if (file_exists("$directory/pools/$name.json")) {
            //             if (openFile("$directory/pools/$name.json","password") === $password) {
            //
            //                 //*** ACTION ***
            //                 RETURN['requests'][r] = json_decode('{"argonInfo":"pool joined"}');
            //                 //*** ACTION ***
            //
            //             } else {
            //                 RETURN['requests'][r] = json_decode('{"argonError":"pool not authenticated"}');
            //             }
            //         } else {
            //             RETURN['requests'][r] = json_decode('{"argonError":"pool does not exist"}');
            //         }
            //     } else {
            //         RETURN['requests'][r] = json_decode('{"argonError":"invalid name or password"}');
            //     }
            // } else if (REQUEST['action'] === "remove pool" && that.action_allowed(REQUEST['action'],authed)) {
            //     $name = REQUEST['name'];
            //     $password = REQUEST['password'];
            //     if (file_exists("$directory/pools/$name.json")) {
            //         if (openFile("$directory/pools/$name.json","password") === $password) {
            //             $owner = openFile("$directory/pools/$name.json",'owner');
            //             if ($owner === $USERNAME) {
            //                 unlink("$directory/pools/$name.json");
            //                 RETURN['requests'][r] = json_decode('{"argonError":"removed pool"}');
            //             } else {
            //                 RETURN['requests'][r] = json_decode('{"argonError":"the owner must remove a pool"}');
            //             }
            //         } else {
            //             RETURN['requests'][r] = json_decode('{"argonError":"pool not authenticated"}');
            //         }
            //     } else {
            //         RETURN['requests'][r] = json_decode('{"argonError":"pool does not exist"}');
            //     }
            // } else if (REQUEST['action'] === "set pool permissions" && that.action_allowed(REQUEST['action'],authed)) {
            //     $name = REQUEST['name'];
            //     $password = REQUEST['password'];
            //     $permissions = REQUEST['permissions'];
            //     if (file_exists("$directory/pools/$name.json")) {
            //         if (openFile("$directory/pools/$name.json","password") === $password) {
            //             //*** ACTION ***
            //             $owner = openFile("$directory/pools/$name.json",'owner');
            //             if ($owner === $USERNAME) {
            //                 $prev_permissions = openFile("$directory/pools/$name.json","permissions");
            //                 if ($prev_permissions === null) {
            //                     $prev_permissions = array();
            //                 }
            //                 foreach($permissions as $permission => $permissionD) {
            //                     $prev_permissions[$permission] = $permissions[$permission];
            //                 }
            //                 saveFile("$directory/pools/$name.json",$prev_permissions,"permissions");
            //                 RETURN['requests'][r] = json_decode('{"argonError":"updated permissions for pool"}');
            //             } else {
            //                 RETURN['requests'][r] = json_decode('{"argonError":"the owner must update permissions for a pool"}');
            //             }
            //             //*** ACTION ***
            //
            //         } else {
            //             RETURN['requests'][r] = json_decode('{"argonError":"pool not authenticated"}');
            //         }
            //     } else {
            //         RETURN['requests'][r] = json_decode('{"argonError":"pool does not exist"}');
            //     }
            } else {
                RETURN['requests'][r] = {"argonError":"action does not exist or is not allowed"};
            }
        } //end main for loop
            return RETURN;
        } else if (authed === -1) {
            /* Generate a new request code, so client cannot attempt to connect without logging back in */
            var t_CODE = generateRandStr(24);
            if (database[that.username].clients === undefined) {
                database[that.username].clients = {};
            }
            var already_present = false; //if user has already been logged in from ip
            for (id in database[that.username].clients) {
                if (that.CLIENT_ID === id) {
                    already_present = true;
                }
            }
            if (already_present === true) {
                database[that.username].clients[that.CLIENT_ID]['request code'] = t_CODE;
            }
            /******/
            return 'Not authenticated';
        } else if (authed === -3) {
            return 'Request dropped by server';
        } else {
            return 'Not authenticated';
        } //end auth if statement

        return RETURN;
    };
    var that = this;
    return that.run();
}

http.createServer(function (req, res) {

    var body = "";
    req.on('data', function (chunk) {
        body += chunk;
        body = body.substr(12, body.length);
        var client_request = JSON.parse(body);
        var response = Request(client_request, req.connection.remoteAddress);
        var json_response = response;
        res.write(JSON.stringify(response));
        res.end();
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
}).listen(9001);

console.log('Argon running on port 9001! Point a new instance of the Argon Object (client.js) to this server.');
