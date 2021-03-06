define("persistent", ["when", "when/guard", "jszip", "underscore.string"], function(when, guard, JSZip, _) {
    when.guard = guard

    var CONCURRENCY = 10;

    var QUOTA = 100 * 1024 * 1024;

    function mkdir(base, dirs) {
	return when.promise(function(resolve, reject) {
	    if (dirs.length == 0) {
		resolve(base);
	    } else {
		var name = dirs.shift();
		base.getDirectory(name, {create: true}, function(dirEntry) {
		    resolve(mkdir(dirEntry, dirs));
		}, reject);
	    }
	});
    }

    function Persistent(ns) {
	this.ns = ns;
    }

    Persistent.prototype = {
	flush: function() {
	    return this.init().then(function() {
		return when.promise(function(resolve, reject) {
		    this.keys(true).then(function(keys) {
			return when.all(keys.map(function(key) {
			    return when.promise(function(resolve, reject) {
				this.root.getDirectory(key, {}, function(entry) {
				    if (entry.isDirectory) {
					console.log('Remove direcotory:', key);
					entry.removeRecursively(resolve, reject);
				    } else {
					console.log('not dir:', key);
				    }
				}, function() {
				    this.root.getFile(key, {}, function(entry) {
					if (entry.isFile) {
					    console.log('Remove file:', key);
					    entry.remove(resolve, reject);
					} else {
					    console.log('not file:', key);
					}
				    }, reject);
				}.bind(this), reject);
			    }.bind(this));
			}.bind(this), reject)).then(resolve, reject);
		    }.bind(this), reject);
		}.bind(this));
	    }.bind(this));
	},
	init: function() {
	    return when.promise(function(resolve, reject) {
		if (this.root) {
		    resolve(this);
		} else {
		    return when.promise(function(resolve, reject) {
			navigator.webkitPersistentStorage.queryUsageAndQuota(
			    function(usage, quota) {
				if (quota < QUOTA) {
				    navigator.webkitPersistentStorage.requestQuota(
					QUOTA, function(bytes) {
					    window.webkitRequestFileSystem(
						PERSISTENT, QUOTA, resolve, reject);
					});
				} else {
				    window.webkitRequestFileSystem(
					PERSISTENT, QUOTA, resolve, reject);
				}
			    });
		    }).then(function(fs) {
			if (!this.ns) {
			    this.ns = '/';
			    this.root = fs.root;
			    resolve(this);
			} else {
			    mkdir(fs.root, this.ns.split('/')).then(function(dirEntry) {
				this.root = dirEntry;
				resolve(this);
			    }.bind(this), reject);
			}
		    }.bind(this), reject);
		}
	    }.bind(this));
	},
	exists: function(key) {
	    key = key + '.dat';
	    return this.init().then(function() {
		return when.promise(function(resolve, reject) {
		    this.root.getFile(key, {}, function() {
			resolve(true);
		    }, function(error) {
			if (error.code == 1) {
			    resolve(false);
			} else {
			    reject(error);
			}
		    });
		}.bind(this));
	    }.bind(this));
	},
	get: function(key) {
	    console.log('Persistent("' + this.ns + '").get("' + key + '")');
	    key = key + '.dat';
	    return this.init().then(function() {
		return when.promise(function(resolve, reject) {
		    this.root.getFile(key, {}, function(fileEntry) {
			fileEntry.file(function(file) {
			    var reader = new FileReader();
			    reader.onprogress = function() {
			    };
			    reader.onloadend = function(e) {
				resolve(this.result);
			    };
			    reader.onerror = function(e) {
				if (e instanceof ProgressEvent) {
				    console.debug('got ProgressEvent, retry:',
						  e, this.ns, key)
				    var new_reader = new FileReader();
				    new_reader.onprogress = reader.onprogress;
				    new_reader.onloadend = reader.onloadend;
				    new_reader.onerror = reader.onerror;
				    reader.readAsText(file);
				    return;
				}
				console.log('Get file error: ' + this.ns + '/' + key);
				console.log(e);
				console.log(e.getMessage());
				reject(e);
			    }.bind(this);
			    reader.readAsText(file);
			}.bind(this), reject);
		    }.bind(this), reject);
		}.bind(this));
	    }.bind(this));
	},
	set: function(key, value) {
	    console.log('Persistent("' + this.ns + '").set("' + key + '")');
	    key = key + '.dat';
	    return this.init().then(function() {
		return when.promise(function(resolve, reject) {
		    this.root.getFile(key, {create: true}, function(fileEntry) {
			fileEntry.createWriter(function(writer) {
			    writer.onerror = function(e) {
				console.log('Write file error:' + key);
				console.log(e.getMessage());
				reject(e);
			    };
			    writer.onwriteend = function() {
				writer.onwriteend = resolve;
				writer.write(new Blob([value], {type: 'application/json'}))
			    }
			    writer.truncate(0);
			}, reject);
		    }, reject);
		}.bind(this));
	    }.bind(this));
	},
	keys: function(with_affix) {
	    return this.init().then(function() {
		return when.promise(function(resolve, reject) {
		    var reader = this.root.createReader();
		    readEntries = function(total) {
			reader.readEntries(function(results) {
			    if (results.length == 0) {
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
		}.bind(this)).then(function(keys) {
		    return keys.map(function(key) {
			if (key.match(/.*\.dat$/) && !with_affix) {
			    return key.substr(0, key.length - 4);
			} else {
			    return key;
			}
		    });
		});
	    }.bind(this));
	},
	remove: function(key, with_affix) {
	    // console.log('Persistent("' + this.ns + '").remove("' + key + '")');
	    if (!with_affix) {
		key = key + '.dat';
	    }
	    return this.init().then(function() {
		var promise = when.promise(function(resolve, reject) {
		    this.root.getFile(key, {create: false}, function(fileEntry) {
			fileEntry.remove(resolve, reject);
		    }, reject);
		}.bind(this));
		return promise;
	    }.bind(this));
	},
	modifiedAt: function(key) {
	    key = key + '.dat';
	    return this.init().then(function() {
		return when.promise(function(resolve, reject) {
		    this.root.getFile(key, {}, function(fileEntry) {
			fileEntry.getMetadata(function(meta) {
			    resolve(meta.modificationTime);
			}, reject);
		    }.bind(this), function() {
			resolve(new Date(0));
		    });
		}.bind(this));
	    }.bind(this));
	},
	outdated: function(key, date) {
	    key = key + '.dat';
	    return this.init().then(function() {
		if (!date) {
		    return true;
		}
		return when.promise(function(resolve, reject) {
		    // if (!date.getTime()) {
		    //     reject('Date error:', key, date);
		    // }
		    // if (date.getTime() < new Date(
		    //     Date.parse('Tue Jul 09 2013 00:00:00 GMT+0800 (CST)')).getTime()) {
		    //     resolve(false);
		    // }
		    this.root.getFile(key, {}, function(fileEntry) {
			fileEntry.getMetadata(function(meta) {
			    resolve(meta.modificationTime.getTime() < date.getTime());
			}, reject);
		    }.bind(this), function() {
			resolve(true);
		    });
		}.bind(this));
	    }.bind(this));
	},
	info: function() {
	    navigator.webkitPersistentStorage.queryUsageAndQuota(
		function(usage, quota) {
		    console.log('Usage:', usage);
		    console.log('Quota:', quota);
		    console.log('Remain:', (quota - usage) / quota);
		});
	},
	unzip: function() {
	},
	zip: function(zipFile) {
	    if (!zipFile) {
		zipFile = new JSZip();
	    }
	    console.log('zip dir: ', this.ns);
	    return this.init().then(function() {
		return when.promise(function(resolve, reject) {
		    // console.log(this.root);
		    var reader = this.root.createReader();
		    var readEntries = function(total) {
			reader.readEntries(function(results) {
			    if (results.length == 0) {
				resolve(total);
			    } else {
				readEntries(total.concat(Array.prototype.slice.call(results, 0)));
			    }
			}.bind(this));
		    }.bind(this);
		    readEntries([]);
		}.bind(this)).then(function(entries) {
		    return when.all(when.map(entries, when.guard(when.guard.n(CONCURRENCY), function(entry) {
			// console.log('handle entry: ', entry);
			if (entry.isDirectory) {
			    var ns = _.lstrip(_.join(this.ns, entry.name), '/');
			    return new Persistent(ns).zip(zipFile.folder(entry.name));
			} else {
			    return when.promise(function(resolve, reject) {
				entry.file(function(file) {
				    var reader = new FileReader();
				    reader.onprogress = function() {
				    };
				    reader.onloadend = function(e) {
					resolve(this.result);
				    };
				    reader.onerror = function(e) {
					if (e instanceof ProgressEvent) {
					    console.debug('got ProgressEvent, retry:',
							  e, this.ns, key)
					    var new_reader = new FileReader();
					    new_reader.onprogress = reader.onprogress;
					    new_reader.onloadend = reader.onloadend;
					    new_reader.onerror = reader.onerror;
					    reader.readAsText(file);
					    return;
					}
					console.log('Get file error: ' + this.ns + '/' + key);
					console.log(e);
					console.log(e.getMessage());
					reject(e);
				    }.bind(this);
				    reader.readAsText(file);
				}.bind(this));
			    }.bind(this)).then(function(data) {
				console.log('zip file: ', _.lstrip(_.join('/', this.ns, entry.name), '/'));
				zipFile.file(entry.name, data);
				return true;
			    }.bind(this));
			}
		    }.bind(this))));
		}.bind(this))
	    }.bind(this)).then(function() {
		return zipFile;
	    });
	},
    };
    return Persistent;
});
