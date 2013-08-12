function Lock(key) {
    this.key = key;
}

Lock.prototype = {
    lock: function() {
	var locks = locache.get('locks');
	if (!locks) {
	    locks = {};
	}
	if (!locks[this.key]) {
	    locks[this.key] = true;
	    locache.set('locks', locks);
	    return true;
	} else {
	    return false;
	}
    },
    release: function() {
	var locks = locache.get('locks');
	if (!locks) {
	    locks = {};
	}
	delete locks[this.key];
	locache.set('locks', locks);
    },
    wait: function() {
	return new RSVP.Promise(function(resolve, reject) {
	    var check = function() {
		if (this.lock()) {
		    resolve();
		} else {
		    setTimeout(check, 5);
		}
	    }.bind(this);
	    check();
	}.bind(this));
    },
};

function test_lock() {
    new Lock('test').wait().then(function() {
	console.log('consumer 1');
	setTimeout(function() {
	    new Lock('test').release();
	}, 3000);
    });
    new Lock('test').wait().then(function() {
	console.log('consumer 2');
	new Lock('test').release();
    });
    new Lock('test').wait().then(function() {
	console.log('consumer 3');
	new Lock('test').release();
    });
    setTimeout(function() {
	new Lock('test').wait().then(function() {
	    console.log('consumer 4');
	    new Lock('test').release();
	});
    }, 5000);
}
