define("app/lock", ["when", "sprintf", "qunit"], function() {
    locks = {};

    function Lock(key) {
	this.key = key;
    }

    Lock.prototype = {
	wait: function() {
	    if (locks[this.key] == undefined) {
		locks[this.key] = when.defer();
		this.release = locks[this.key].resolve;
		return when.promise(function(resolve) {
		    resolve(this);
		}.bind(this));
	    } else {
		var origin = locks[this.key];
		locks[this.key] = when.defer();
		this.release = locks[this.key].resolve;
		return origin.promise.then(function() {
		    return this;
		}.bind(this));
	    }
	},
	test: function() {
	    test( "hello test", function() {
		ok( 1 == "1", "Passed!" );
	    });
	    // new Lock('test').wait().then(function(lock) {
	    // 	console.log('consumer 1');
	    // 	setTimeout(function() {
	    // 	    lock.release();
	    // 	}, 3000);
	    // });
	    // new Lock('test').wait().then(function(lock) {
	    // 	console.log('consumer 2');
	    // 	lock.release();
	    // });
	    // new Lock('test').wait().then(function(lock) {
	    // 	console.log('consumer 3');
	    // 	lock.release();
	    // });
	    // setTimeout(function() {
	    // 	new Lock('test').wait().then(function(lock) {
	    // 	    console.log('consumer 4');
	    // 	    lock.release();
	    // 	});
	    // }, 5000);
	},
    };

    Lock.test = function() {
	test( "hello test", function() {
	    ok( 1 == "1", "Passed!" );
	});
    };

    function benchmark_lock() {
	var MAX = 1000;
	var start = new Date();
	var promises = [];
	for (var i = 0; i < MAX; i++) {
	    promises.push(new Lock('test').wait().then(function(lock) {
		lock.release();
	    }));
	}
	RSVP.all(promises).then(function() {
	    console.log(sprintf("lock %s times: %s seconds",
				MAX, (new Date() - start) / 1000));
	})
    }
    return Lock;
});
