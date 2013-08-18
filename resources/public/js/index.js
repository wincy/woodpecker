function Index(from, to) {
    this.from = from;
    this.to = to;
}

function rejectHandler(error) {
    if (this.info) {
	console.log(this.info);
    }
    console.log(error);
    if (error && error.stack) {
	console.log(error.stack);
    } else {
	var trace = printStackTrace();
        console.log(trace.join('\n'));
    }
    throw error;
}

Index.prototype = {
    set: function(key, value) {
	return new Lock(this.from + '/' + this.to).wait().then(function() {
	    // console.log('Lock for:', key, value);
	    return new Persistent(this.from).exists(this.to)
		.then(function(exists) {
		    if (exists) {
			return new Persistent(this.from).get(this.to)
			    .then(function(data) {
				var index = JSON.parse(data);
				index[key] = value;
				console.log(sprintf("Set index %s -> %s:",
						    this.from, this.to,
						    key, value));
				return new Persistent(this.from)
				    .set(this.to, JSON.stringify(index));
			    }.bind(this), rejectHandler);
		    } else {
			var index = {};
			index[key] = value;
			console.log(sprintf("Set index %s -> %s:",
					    this.from, this.to,
					    key, value));
			return new Persistent(this.from)
			    .set(this.to, JSON.stringify(index));
		    }
		}.bind(this), rejectHandler);
	}.bind(this), rejectHandler).then(function() {
	    // console.log('Release for:', key, value);
	    return new Lock(this.from + '/' + this.to).release();
	}.bind(this), rejectHandler);
    },
    get: function(key) {
	return new Persistent(this.from).exists(this.to).then(function(exists) {
	    if (exists) {
		return new Persistent(this.from).get(this.to).then(function(data) {
		    return JSON.parse(data)[key];
		}, rejectHandler);
	    } else {
		return {}[key];
	    }
	}.bind(this), rejectHandler);
    },
};

function test_index() {
    var index = new Index('task.name', 'task.id');
    var assert = function(key, value) {
	return index.get(key).then(function(v) {
	    if (v != value) {
		throw sprintf("Index(%s, %s) error: %s != %s, but %s",
			      index.from, index.to, key, value, v);
	    }
	}, rejectHandler)
    };
    return RSVP.all([
	index.set('name-1', 'id-1'),
	index.set('name-2', 'id-2'),
	index.set('name-3', 'id-3'),
	index.set('name-4', 'id-4'),
	index.set('name-5', 'id-5'),
	index.set('name-6', 'id-6'),
	index.set('name-7', 'id-7'),
	index.set('name-8', 'id-8'),
	index.set('name-9', 'id-9'),
    ]).then(function() {
	return RSVP.all([
	    assert('name-1', 'id-1'),
	    assert('name-2', 'id-2'),
	    assert('name-3', 'id-3'),
	    assert('name-4', 'id-4'),
	    assert('name-5', 'id-5'),
	    assert('name-6', 'id-6'),
	    assert('name-7', 'id-7'),
	    assert('name-8', 'id-8'),
	    assert('name-9', 'id-9'),
	])
    }, rejectHandler)
}
