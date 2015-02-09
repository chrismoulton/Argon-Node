# Argon Node

An experimental build of Argon built on top of Node.js.
______

*Hint: No third-party Node.js modules are required.*

#### Important Notes

This is an experimental build. There will be bugs. Some features, such as pools, are not currently available.

The database is currently saved on an interval. If the server is shut down, clients may be logged out.

### 1. Run server.js with Node.js on the Server:
```
node server.js
```

### 2. Add client.js to the <head> of a page:
```html
<script src = "client.js"></script>
```

### 3. Create a new instance of the Argon() Object on the Client:
```javascript
var server = new Argon('http://url:9001')
```
*Hint: The first parameter points to the Node.js server. Don't forget ':9001'.*

### 4. Code Away!

With a few exceptions, Argon Node works the same as the current Argon based on PHP!

#### Create User

```javascript
server.user.create('username', 'password')
```

#### Login User

```javascript
server.user.login('username', 'password')
```

#### Update Data

```javascript
server.user.update({property: 'value'})
```

### Get Data

```javascript
server.user.get()
```

*Code Responsibly: Experimental Project*
______

**- @LoadFive**
