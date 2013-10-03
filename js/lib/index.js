define("index", ["sprintf", "when", "lock", "persistent"], function(sprintf, when, Lock, Persistent) {
    function Index(from, to) {
	this.from = from;
	this.to = to;
    }

    Index.prototype = {
	set: function(key, value) {
	    return new Lock(this.from + '/' + this.to).wait().then(function(lock) {
		// console.log('Lock for:', key, value);
		return new Persistent(this.from).exists(this.to)
		    .then(function(exists) {
			if (exists) {
			    return new Persistent(this.from).get(this.to)
				.then(function(data) {
				    var index = {};
				    if (data.length > 0) {
					index =  JSON.parse(data);
				    }
				    index[key] = value;
				    // console.log(sprintf("Set index %s -> %s:",
				    // 		    this.from, this.to,
				    // 		    key, value));
				    return new Persistent(this.from)
					.set(this.to, JSON.stringify(index));
				}.bind(this));
			} else {
			    var index = {};
			    index[key] = value;
			    // console.log(sprintf("Set index %s -> %s:",
			    // 		    this.from, this.to,
			    // 		    key, value));
			    return new Persistent(this.from)
				.set(this.to, JSON.stringify(index));
			}
		    }.bind(this))
		    .then(function() {
			lock.release();
		    });
	    }.bind(this));
	},
	get: function(key) {
	    return new Persistent(this.from).exists(this.to).then(function(exists) {
		if (exists) {
		    return new Persistent(this.from).get(this.to).then(function(data) {
			return JSON.parse(data)[key];
		    });
		} else {
		    return {}[key];
		}
	    }.bind(this));
	},
	sadd: function(key, value) {
	    return new Lock(this.from + '/' + this.to).wait().then(function(lock) {
		// console.log('Lock for:', key, value);
		return new Persistent(this.from).exists(this.to)
		    .then(function(exists) {
			if (exists) {
			    return new Persistent(this.from).get(this.to)
				.then(function(data) {
				    var index = {};
				    if (data.length > 0) {
					index =  JSON.parse(data);
				    }
				    if (index[key] == undefined) {
					index[key] = [];
				    }
				    console.log(sprintf(
					"new Index('%s', '%s').sadd('%s', '%s')",
					this.from, this.to, key, value));
				    if (index[key].indexOf(value) == -1) {
					index[key].push(value);
					return new Persistent(this.from)
					    .set(this.to, JSON.stringify(index));
				    }
				}.bind(this));
			} else {
			    var index = {};
			    index[key] = [value];
			    console.log(sprintf(
				"new Index('%s', '%s').sadd('%s', '%s')",
				this.from, this.to, key, value));
			    return new Persistent(this.from)
				.set(this.to, JSON.stringify(index));
			}
		    }.bind(this))
		    .then(function() {
			lock.release();
		    });
	    }.bind(this));
	},
	srem: function(key, value) {
	    return new Lock(this.from + '/' + this.to).wait().then(function(lock) {
		// console.log('Lock for:', key, value);
		return new Persistent(this.from).exists(this.to)
		    .then(function(exists) {
			if (exists) {
			    return new Persistent(this.from).get(this.to)
				.then(function(data) {
				    var index = {};
				    if (data.length > 0) {
					index =  JSON.parse(data);
				    }
				    if (index[key] == undefined) {
					return;
				    }
				    if (index[key].indexOf(value) != -1) {
					index[key].removeObject(value);
					console.log(sprintf("srem(%s, %s) -> %s:",
				    			    key, value,
				    			    JSON.stringify(index)));
					return new Persistent(this.from)
					    .set(this.to, JSON.stringify(index));
				    }
				}.bind(this));
			}
		    }.bind(this))
		    .then(function() {
			lock.release();
		    });
	    }.bind(this));
	},
	smembers: function(key) {
	    return new Persistent(this.from).exists(this.to).then(function(exists) {
		if (exists) {
		    return new Persistent(this.from).get(this.to).then(function(data) {
			var index = JSON.parse(data);
			if (index[key] == undefined) {
			    return [];
			} else {
			    return index[key];
			}
		    });
		} else {
		    return [];
		}
	    }.bind(this));
	},
    };

    function test_index() {
	var index = new Index('test-name', 'test-id');
	var assert = function(method, key, value) {
	    return index[method](key).then(function(v) {
		if (v < value || v > value) {
		    throw sprintf("Index(%s, %s) error: %s != %s, but %s",
				  index.from, index.to, key, value, v);
		}
	    })
	};
	return when.all([
	    index.set('name-1', 'id-1'),
	    index.set('name-2', 'id-2'),
	    index.set('name-3', 'id-3'),
	    index.set('name-4', 'id-4'),
	    index.set('name-5', 'id-5'),
	    index.set('name-6', 'id-6'),
	    index.set('name-7', 'id-7'),
	    index.set('name-8', 'id-8'),
	    index.set('name-9', 'id-9'),
	    index.sadd('name-10', 'id-10'),
	]).then(function() {
	    return when.all([
		assert('get', 'name-1', 'id-1'),
		assert('get', 'name-2', 'id-2'),
		assert('get', 'name-3', 'id-3'),
		assert('get', 'name-4', 'id-4'),
		assert('get', 'name-5', 'id-5'),
		assert('get', 'name-6', 'id-6'),
		assert('get', 'name-7', 'id-7'),
		assert('get', 'name-8', 'id-8'),
		assert('get', 'name-9', 'id-9'),
		assert('smembers', 'name-10', ['id-10']),
	    ]).then(function() {
		return when.all([
		    index.srem('name-10', 'id-10'),
		]).then(function() {
		    return assert('smembers', 'name-10', []);
		});
	    });
	});
    }
    return Index;
});
