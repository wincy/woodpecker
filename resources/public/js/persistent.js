var fs = null;
var QUOTA = 10 * 1024 * 1024;

function rejectHandler(error) {
    console.log(error);
}

$(document).ready(function() {
    function onInitFs(filesystem) {
	fs = filesystem;
    }
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    window.storageInfo = window.storageInfo || window.webkitStorageInfo;
    window.storageInfo.queryUsageAndQuota(PERSISTENT, function(usage, quota) {
	if (quota == 0) {
	    window.storageInfo.requestQuota(PERSISTENT, QUOTA, function(bytes) {
		window.requestFileSystem(PERSISTENT, QUOTA, onInitFs, rejectHandler);
	    });
	} else {
	    window.requestFileSystem(PERSISTENT, QUOTA, onInitFs, rejectHandler);
	}
    });
});

function Persistent(ns) {
    this.ns = ns;
}

Persistent.prototype = {
    init: function() {
	var promise = new RSVP.Promise(function(resolve, reject) {
	    if (this.root) {
		resolve(this);
	    } else {
		if (!this.ns) {
		    this.root = fs.root;
		    resolve(this);
		} else {
		    fs.root.getDirectory(this.ns, {create: true}, function(dirEntry) {
			this.root = dirEntry;
			resolve(this);
		    }.bind(this), reject);
		}
	    }
	}.bind(this));
	return promise;
    },
    get: function(key) {
	console.log('Persistent("' + this.ns + '").get("' + key + '")');
	return this.init().then(function() {
	    var promise = new RSVP.Promise(function(resolve, reject) {
		this.root.getFile(key, {}, function(fileEntry) {
		    fileEntry.file(function(file) {
			var reader = new FileReader();
			reader.onloadend = function(e) {
			    resolve(this.result);
			};
			reader.onerror = reject;
			reader.readAsText(file);
		    }, reject);
		}, reject);
	    }.bind(this));
	    return promise;
	}.bind(this), rejectHandler);
    },
    set: function(key, value) {
	console.log('Persistent("' + this.ns + '").get("' + key + '", "' + value + '")');
	return this.init().then(function() {
	    var promise = new RSVP.Promise(function(resolve, reject) {
		this.root.getFile(key, {create: true}, function(fileEntry) {
		    fileEntry.createWriter(function(writer) {
			writer.onwriteend = resolve;
			writer.onerror = reject;
			writer.write(new Blob([value], {type: 'application/json'}))
		    }, reject);
		}, reject);
	    }.bind(this));
	}.bind(this), rejectHandler);
	return promise;
    },
    keys: function() {
	return this.init().then(function() {
	    var promise = new RSVP.Promise(function(resolve, reject) {
		var reader = this.root.createReader();
		readEntries = function(total) {
		    reader.readEntries(function(results) {
			if (!results.length) {
			    resolve(total);
			} else {
			    readEntries(total.concat(
				Array.prototype.slice.call(results, 0).map(
				    function(fileEntry) {
					return fileEntry.name;
				    })));
			}
		    }, reject);
		};
		readEntries([]);
	    }.bind(this));
	    return promise;
	}.bind(this), rejectHandler);
    },
    remove: function(key) {
	console.log('Persistent("' + this.ns + '").remove("' + key + '")');
	return this.init().then(function() {
	    var promise = new RSVP.Promise(function(resolve, reject) {
		this.root.getFile(key, {create: false}, function(fileEntry) {
		    fileEntry.remove(resolve, reject);
		}, reject);
	    }.bind(this));
	    return promise;
	}.bind(this), rejectHandler);
    },
};
