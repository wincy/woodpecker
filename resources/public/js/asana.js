Function.prototype.partial = function() {
    var fn = this, args = Array.prototype.slice.call(arguments);
    return function(){
	var arg = 0;
	for ( var i = 0; i < args.length && arg < arguments.length; i++ )
            if ( args[i] === undefined )
		args[i] = arguments[arg++];
	return fn.apply(this, args);
    };
};

function bindAll(target, that) {
    var result = {};
    for (var key in target) {
	if (typeof target[key] == 'function') {
	    result[key] = target[key].bind(that);
	} else {
	    result[key] = that;
	}
    }
    return result;
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

Asana = function(ns) {
    this.ns = ns;
    this.User = bindAll(this.User, this);
    this.Workspace = bindAll(this.Workspace, this);
}

Asana.prototype = {
    delay: function (timeout) {
	var p = RSVP.Promise(function(resolve, reject) {
	    setTimeout(resolve, timeout);
	});
	return p;
    },
    request: function(url, params, method) {
	var key = JSON.stringify({url: url, params: params, method: method});
	full_url = this.ns + url;
	if (params == undefined) {
	    params = {};
	}
	if (method == undefined) {
	    method = 'GET';
	}
	var promise = new RSVP.Promise(function(resolve, reject) {
	    if (navigator.onLine) {
		$.ajax({
		    url: full_url,
		    data: params,
		    type: method,
		    timeout: 30000,
		    dataType: 'json',
		    // error: function(xhr, status, error) {
		    // 	if (xhr.status == 429 || error == 'timeout') {
		    // 	    console.log('will retry');
		    // 	}
		    // },
		})
		    .done(function(data, status, xhr) {
			if (!data.data) {
			    reject('data is not valid:' + JSON.stringify(data));
			} else {
			    resolve(data.data);
			}
		    })
		    .fail(function(xhr, status, error) {
			if (xhr.status == 429 || error == 'timeout') {
			    var timeout = 0;
			    if (xhr.status == 429) {
				timeout = JSON.parse(xhr.responseText).retry_after * 1000;
			    }
			    asana.delay(timeout).then(function() {
				asana.request(url, params, method)
				    .then(function(data) {
					this.resolve(data);
				    }.bind(this), function(error) {
					console.log('reject @ retry:', error);
					this.reject(error);
				    }.bind(this));
			    }.bind({resolve: resolve, reject: reject}))
			} else {
			    console.log(xhr);
			    console.log(error);
			    reject(xhr.responseText);
			}
		    });
	    } else {
		reject('offline now');
	    }
	}.bind(this));
	return promise;
    },
    sync: function(types) {
	return new RSVP.Promise(function(resolve, reject) {
	    if (!navigator.onLine) {
		console.log('offline now, using cache');
		resolve(this);
	    } else {
		resolve(RSVP.all(types.map(function(klass) {
		    return asana.request('/' + klass.prototype.key,
					 {opt_fields: 'modified_at,created_at'})
			.then(function(data) {
			    new Persistent().set(klass.prototype.key, JSON.stringify(data));
			    return data;
			}, rejectHandler)
			.then(function(items) {
			    return RSVP.all(items.map(function(item) {
				var last_update = null;
				if (item.created_at) {
				    last_update = new Date(Date.parse(item.created_at));
				}
				if (item.modified_at) {
				    last_update = new Date(Date.parse(item.modified_at));
				}
				if (!last_update) {
				    last_update = new Date();
				}
				return new klass(item.id).sync(last_update, true);
			    }));
			}, rejectHandler);
		})));
	    }
	}.bind(this));
    },
    User: {
	get: function(conditions) {
	    var klass = this.User;
	    return klass.find().then(function(items) {
		var matched = items.filter(function(item) {
		    return Object.keys(conditions).every(function(field) {
			return conditions[field] == item[field];
		    });
		});
		if (matched.length == 0) {
		    alert(sprintf("User is not found. %s",
				  JSON.stringify(conditions)))
		} else {
		    return matched[0];
		}
	    });
	},
	find: function() {
	    return new Persistent().get('users')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.User.find();
			    });
		    }
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.User(item.id).load();
		    }));
		}, rejectHandler);
	},
    },
    Workspace: {
	get: function(conditions) {
	    var klass = this.Workspace;
	    return klass.find().then(function(items) {
		var matched = items.filter(function(item) {
		    return Object.keys(conditions).every(function(field) {
			return conditions[field] == item[field];
		    });
		});
		if (matched.length == 0) {
		    alert(sprintf("Workspace is not found. %s",
				  JSON.stringify(conditions)))
		} else {
		    return matched[0];
		}
	    });
	},
	find: function() {
	    return new Persistent().get('workspaces')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.Workspace.find();
			    });
		    }
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.Workspace(item.id).load();
		    }));
		}, rejectHandler);
	},
    },
}

Asana.Workspace = function(id) {
    this.id = id;
    this.Task = bindAll(this.Task, this);
    this.Project = bindAll(this.Project, this);
    this.Tag = bindAll(this.Tag, this);
}

Asana.Workspace.prototype = {
    key: 'workspaces',
    sync: function(last_update, deep) {
	return new Persistent(this.key).outdated(this.id, last_update)
	    .then(function(outdated) {
		if (!outdated) {
		    return this;
		}
		return asana.request('/' + this.key + '/' + this.id)
		    .then(function(data) {
			new Persistent(this.key).set(this.id, JSON.stringify(data));
			return data;
		    }.bind(this), rejectHandler)
		    .then(function(data) {
			return $.extend(this, data);
		    }.bind(this), rejectHandler);
	    }.bind(this), rejectHandler)
	    .then(function(item) {
		if (!deep) {
		    return this;
		}
		return RSVP.all([
		    asana.request('/' + item.key + '/' + item.id + '/' + 'projects',
				  {opt_fields: 'modified_at'})
			.then(function(data) {
			    return new Persistent(item.key + '/' + item.id)
				.set('projects', JSON.stringify(data))
				.then(function() {
				    return data;
				}, rejectHandler);
			}, rejectHandler)
			.then(function(items) {
			    return RSVP.all(items.map(function(item) {
				return new Asana.Project(item.id).sync(
				    new Date(Date.parse(item.modified_at)), false);
			    }));
			}, rejectHandler),
		    asana.request('/' + item.key + '/' + item.id + '/' + 'tags',
				  {opt_fields: 'created_at'})
			.then(function(data) {
			    return new Persistent(item.key + '/' + item.id)
				.set('tags', JSON.stringify(data))
				.then(function() {
				    return data;
				}, rejectHandler);
			}, rejectHandler)
			.then(function(items) {
			    return RSVP.all(items.map(function(item) {
				return new Asana.Tag(item.id).sync(
				    new Date(Date.parse(item.created_at)), false);
			    }));
			}, rejectHandler),
		]).then(function() {
		    return this;
		}.bind(this), rejectHandler);
	    }.bind(this), rejectHandler);
    },
    load: function() {
	var p = new Persistent(this.key);
	return p.exists(this.id).then(function(exists) {
	    if (exists) {
		return p.get(this.id).then(function(data) {
		    try {
			return $.extend(this, JSON.parse(data));
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true);
		    }
		}.bind(this), rejectHandler);
	    } else {
		return this.sync(new Date(), true);
	    }
	}.bind(this), rejectHandler);
    },
    Project: {
	get: function(conditions) {
	    var klass = this.Project;
	    return klass.find().then(function(items) {
		var matched = items.filter(function(item) {
		    return Object.keys(conditions).every(function(field) {
			return conditions[field] == item[field];
		    });
		});
		if (matched.length == 0) {
		    return klass.create(conditions);
		} else {
		    return matched[0];
		}
	    })
	},
	create: function(data) {
	    return asana.request(
		'/workspaces/' + this.id + '/projects',
		data,
		'POST')
		.then(function(data) {
		    return new Persistent('projects')
			.set(data.id, JSON.stringify(data))
			.then(function() {
			    return data;
			}, rejectHandler);
		}, rejectHandler)
		.then(function(data) {
		    return $.extend(new Asana.Project(data.id), data);
		}, rejectHandler)
		.then(function(item) {
		    return item.sync(new Date(Date.parse(item.created_at)))
			.then(function() {
			    return this.sync(new Date()).then(function() {
				return item;
			    });
			}.bind(this), rejectHandler);
		}.bind(this), rejectHandler);
	},
	find: function() {
	    return new Persistent(this.key + '/' + this.id).get('projects')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.Project.find();
			    });
		    }
		    return JSON.parse(data);
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.Project(item.id).load();
		    }));
		}, rejectHandler);
	},
    },
    Tag: {
	get: function(conditions) {
	    var klass = this.Tag;
	    return klass.filter(conditions).then(function(item) {
		if (!item) {
		    return klass.create(conditions);
		} else {
		    return item;
		}
	    })
	},
	create: function(data) {
	    return asana.request(
		'/workspaces/' + this.id + '/tags',
		data,
		'POST')
		.then(function(data) {
		    return new Persistent('tags')
			.set(data.id, JSON.stringify(data))
			.then(function() {
			    return data;
			}, rejectHandler);
		}, rejectHandler)
		.then(function(data) {
		    return $.extend(new Asana.Tag(data.id), data);
		}, rejectHandler)
		.then(function(item) {
		    return item.sync(new Date(Date.parse(item.created_at)))
			.then(function() {
			    return this.sync(new Date()).then(function() {
				return item;
			    });
			}.bind(this), rejectHandler);
		}.bind(this), rejectHandler)
		.then(function(item) {
		    return new Index('tag.name', 'tag.id')
			.set(item.name, item.id)
			.then(function() {
			    return item;
			}, rejectHandler);
		}, rejectHandler);
	},
	find: function() {
	    return new Persistent(this.key + '/' + this.id).get('tags')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.Tag.find();
			    });
		    }
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.Tag(item.id).load();
		    }));
		}, rejectHandler);
	},
	filter: function(conditions) {
	    if (conditions.name) {
		return new Index('tag.name', 'tag.id').get(conditions.name)
		    .then(function(id) {
			if (id) {
			    return new Asana.Tag(id).load();
			} else {
			    return id;
			}
		    });
	    } else {
		throw "Filter not support yet."
	    }
	},
    },
}

Asana.Project = function(id) {
    this.key = 'projects';
    this.id = id;
    this.name = null;
    this.Task = bindAll(this.Task, this);
}

Asana.Project.prototype = {
    key: 'projects',
    sync: function(last_update, deep) {
	return new Persistent(this.key).outdated(this.id, last_update)
	    .then(function(outdated) {
		if (!outdated) {
		    return this;
		}
		return asana.request('/' + this.key + '/' + this.id)
		    .then(function(data) {
			new Persistent(this.key).set(this.id, JSON.stringify(data));
			return data;
		    }.bind(this), rejectHandler)
		    .then(function(data) {
			return $.extend(this, data);
		    }.bind(this), rejectHandler);
	    }.bind(this), rejectHandler)
	    .then(function(item) {
		if (!deep) {
		    return this;
		}
		return RSVP.all([
		    asana.request('/' + item.key + '/' + item.id + '/' + 'tasks',
				  {opt_fields: 'modified_at'})
			.then(function(data) {
			    return new Persistent(item.key + '/' + item.id)
				.set('tasks', JSON.stringify(data))
				.then(function() {
				    return data;
				}, rejectHandler);
			}, rejectHandler)
			.then(function(items) {
			    return RSVP.all(items.map(function(item) {
				return new Asana.Task(item.id).sync(
				    new Date(Date.parse(item.modified_at)), false);
			    }));
			}, rejectHandler),
		]).then(function() {
		    return this;
		}.bind(this), rejectHandler);
	    }.bind(this), rejectHandler);
    },
    load: function() {
	var p = new Persistent(this.key);
	return p.exists(this.id).then(function(exists) {
	    if (exists) {
		return p.get(this.id).then(function(data) {
		    try {
			return $.extend(this, JSON.parse(data));
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true);
		    }
		}.bind(this), rejectHandler);
	    } else {
		return this.sync(new Date(), true);
	    }
	}.bind(this), rejectHandler);
    },
    Task: {
	get: function(conditions) {
	    var klass = this.Task;
	    return klass.filter(conditions).then(function(item) {
		if (!item) {
		    return klass.create(conditions);
		} else {
		    return item;
		}
	    })
	},
	// getByName: function(name) {
	//     if (this.id != asana.woodpecker.me.id) {
	// 	console.log('cannot call Task.getByName');
	//     }
	//     var date = name.split('#')[0];
	//     var index = name.split('#')[1];
	//     var cache = locache.get(date);
	//     if (date) {
	// 	if (cache && cache[index]) {
	// 	    return new Asana.Task(cache[index].id).load();
	// 	} else {
	// 	    return this.Task.create({
	// 		name: name,
	// 		assignee: 'me',
	// 		assignee_status: 'today',
	// 	    });
	// 	}
	//     }
	// },
	create: function(data) {
	    data['workspace'] = this.workspace.id;
	    data['projects[0]'] = this.id;
	    return asana.request(
		'/tasks',
		data,
		'POST')
		.then(function(data) {
		    return new Persistent('tasks')
			.set(data.id, JSON.stringify(data))
			.then(function() {
			    return data;
			}, rejectHandler);
		}, rejectHandler)
		.then(function(data) {
		    return $.extend(new Asana.Task(data.id), data);
		}, rejectHandler)
		.then(function(item) {
		    return item.sync(new Date(Date.parse(item.created_at)))
			.then(function() {
			    return this.sync(new Date()).then(function() {
				return item;
			    }, rejectHandler);
			}.bind(this), rejectHandler);
		}.bind(this), rejectHandler)
		.then(function(item) {
		    return new Index('task.name', 'task.id')
			.set(item.name, item.id)
			.then(function() {
			    return item;
			}, rejectHandler);
		}, rejectHandler);
	},
	find: function() {
	    return new Persistent(this.key + '/' + this.id).get('tasks')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.Task.find();
			    });
		    }
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.Task(item.id).load();
		    }));
		}, rejectHandler);
	},
	filter: function(conditions) {
	    if (conditions.name) {
		return new Index('task.name', 'task.id').get(conditions.name)
		    .then(function(id) {
			if (id) {
			    return new Asana.Task(id).load();
			} else {
			    return id;
			}
		    });
	    } else {
		throw "Filter not support yet."
	    }
	},
    }
}

Asana.Task = function(id) {
    this.key = 'tasks';
    this.id = id;
    this.Story = bindAll(this.Story, this);
    this.Tag = bindAll(this.Tag, this);
}

Asana.Task.prototype = {
    key: 'tasks',
    sync: function(last_update, deep) {
	return new Persistent(this.key).outdated(this.id, last_update)
	    .then(function(outdated) {
		if (!outdated) {
		    return this;
		}
		return asana.request('/' + this.key + '/' + this.id)
		    .then(function(data) {
			return RSVP.all([
			    new Persistent(this.key).set(this.id, JSON.stringify(data)),
			    new Index('task.name', 'task.id').set(data.name, data.id),
			]).then(function() {
			    return data;
			}, rejectHandler);
		    }.bind(this), rejectHandler)
		    .then(function(data) {
			console.log('Sync:', this.key, this.id);
			return $.extend(this, data);
		    }.bind(this), rejectHandler);
	    }.bind(this), rejectHandler)
	    .then(function(item) {
	    	if (!deep) {
	    	    return this;
	    	}
	    	return RSVP.all([
	    	    asana.request('/' + item.key + '/' + item.id + '/' + 'stories',
	    	    		  {opt_fields: 'created_at'})
	    	    	.then(function(data) {
	    	    	    return new Persistent(item.key + '/' + item.id)
	    	    		.set('tasks', JSON.stringify(data))
	    	    		.then(function() {
	    	    		    return data;
	    	    		}, rejectHandler);
	    	    	}, rejectHandler)
	    	    	.then(function(items) {
	    	    	    return RSVP.all(items.map(function(item) {
	    	    		return new Asana.Story(item.id).sync(
	    	    		    new Date(Date.parse(item.created_at)),
				    false);
	    	    	    }));
	    	    	}, rejectHandler),
	    	    asana.request('/' + item.key + '/' + item.id + '/' + 'tags',
	    	    		  {opt_fields: 'created_at'})
	    	    	.then(function(data) {
	    	    	    return new Persistent(item.key + '/' + item.id)
	    	    		.set('tags', JSON.stringify(data))
	    	    		.then(function() {
	    	    		    return data;
	    	    		}, rejectHandler);
	    	    	}, rejectHandler)
	    	    	.then(function(items) {
	    	    	    return RSVP.all(items.map(function(item) {
	    	    		return new Asana.Tag(item.id).sync(
	    	    		    new Date(Date.parse(item.created_at)),
				    false);
	    	    	    }));
	    	    	}, rejectHandler),
	    	]).then(function() {
	    	    return this;
	    	}.bind(this), rejectHandler);
	    }.bind(this), rejectHandler);
    },
    load: function() {
	var p = new Persistent(this.key);
	return p.exists(this.id).then(function(exists) {
	    if (exists) {
		return p.get(this.id).then(function(data) {
		    try {
			if (Object.getOwnPropertyNames(this).filter(
			    function (s) {
				return !s.search(/__ember/);
			    })[0]) {
			    console.log('Gotcha:', this);
			    throw this;
			}
			return $.extend(this, JSON.parse(data));
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true);
		    }
		}.bind(this), rejectHandler);
	    } else {
		return this.sync(new Date(), true);
	    }
	}.bind(this), rejectHandler);
    },
    update: function(kvs) {
	return asana.request('/tasks/' + this.id, kvs, 'PUT')
	    .then(function(data) {
		new Persistent('tasks').set(data.id, JSON.stringify(data));
		return data;
	    }, rejectHandler)
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this), rejectHandler);
    },
    addTag: function(tag) {
	return asana.request('/tasks/' + this.id + '/addTag', {tag: tag.id}, 'POST');
    },
    removeTag: function(tag) {
	return asana.request('/tasks/' + this.id + '/removeTag', {tag: tag.id}, 'POST');
    },
    Story: {
	create: function(data) {
	    return asana.request(
		'/tasks/' + this.id + '/stories',
		data,
		'POST')
		.then(function(data) {
		    return new Persistent('stories')
			.set(data.id, JSON.stringify(data))
			.then(function() {
			    return data;
			}, rejectHandler);
		}, rejectHandler)
		.then(function(data) {
		    return $.extend(new Asana.Story(data.id), data);
		}, rejectHandler)
		.then(function(item) {
		    return item.sync(new Date(Date.parse(item.created_at)))
			.then(function() {
			    // return this.sync(new Date()).then(function() {
				return item;
			    // });
			}.bind(this), rejectHandler);
		}.bind(this), rejectHandler);
	},
	find: function() {
	    return new Persistent(this.key + '/' + this.id).get('stories')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.Story.find();
			    });
		    }
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.Story(item.id).load();
		    }));
		}, rejectHandler);
	},
    },
    Tag: {
	find: function() {
	    return new Persistent(this.key + '/' + this.id).get('tags')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.Tag.find();
			    });
		    }
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.Tag(item.id).load();
		    }));
		}, rejectHandler);
	},
    },
}

Asana.Story = function(id) {
    this.key = 'stories';
    this.id = id;
}

Asana.Story.prototype = {
    key: 'stories',
    sync: function(last_update, deep) {
	return new Persistent(this.key).outdated(this.id, last_update)
	    .then(function(outdated) {
		if (!outdated) {
		    return this;
		}
		return asana.request('/' + this.key + '/' + this.id)
		    .then(function(data) {
			new Persistent(this.key).set(this.id, JSON.stringify(data));
			return data;
		    }.bind(this), rejectHandler)
		    .then(function(data) {
			console.log('Sync:', this.key, this.id);
			return $.extend(this, data);
		    }.bind(this), rejectHandler);
	    }.bind(this), rejectHandler);
    },
    load: function() {
	var p = new Persistent(this.key);
	return p.exists(this.id).then(function(exists) {
	    if (exists) {
		return p.get(this.id).then(function(data) {
		    try {
			return $.extend(this, JSON.parse(data));
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date());
		    }
		}.bind(this), rejectHandler);
	    } else {
		return this.sync(new Date());
	    }
	}.bind(this), rejectHandler);
    },
}

Asana.User = function(id) {
    this.key = 'users';
    this.id = id;
}

Asana.User.prototype = {
    key: 'users',
    sync: function(last_update, deep) {
	return new Persistent(this.key).outdated(this.id, last_update)
	    .then(function(outdated) {
		if (!outdated) {
		    return this;
		}
		return asana.request('/' + this.key + '/' + this.id)
		    .then(function(data) {
			new Persistent(this.key).set(this.id, JSON.stringify(data));
			return data;
		    }.bind(this), rejectHandler)
		    .then(function(data) {
			console.log('Sync:', this.key, this.id);
			return $.extend(this, data);
		    }.bind(this), rejectHandler);
	    }.bind(this), rejectHandler);
    },
    load: function() {
	var p = new Persistent(this.key);
	return p.exists(this.id).then(function(exists) {
	    if (exists) {
		return p.get(this.id).then(function(data) {
		    try {
			return $.extend(this, JSON.parse(data));
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date());
		    }
		}.bind(this), rejectHandler);
	    } else {
		return this.sync(new Date());
	    }
	}.bind(this), rejectHandler);
    },
}

Asana.Tag = function(id) {
    this.key = 'tags';
    this.id = id;
    this.Task = bindAll(this.Task, this);
}

Asana.Tag.prototype = {
    key: 'tags',
    sync: function(last_update, deep) {
	return new Persistent(this.key).outdated(this.id, last_update)
	    .then(function(outdated) {
		if (!outdated) {
		    return this;
		}
		return asana.request('/' + this.key + '/' + this.id)
		    .then(function(data) {
			new Persistent(this.key).set(this.id, JSON.stringify(data));
			new Index('tag.name', 'tag.id').set(data.name, data.id);
			return data;
		    }.bind(this), rejectHandler)
		    .then(function(data) {
			console.log('Sync:', this.key, this.id);
			return $.extend(this, data);
		    }.bind(this), rejectHandler);
	    }.bind(this), rejectHandler)
	    .then(function(item) {
	    	return RSVP.all([
	    	    asana.request('/' + item.key + '/' + item.id + '/' + 'tasks',
	    			  {opt_fields: 'modified_at'})
	    		.then(function(data) {
	    		    return new Persistent(item.key + '/' + item.id)
	    			.set('tasks', JSON.stringify(data))
	    			.then(function() {
	    			    return data;
	    			}, rejectHandler);
	    		}, rejectHandler)
	    		.then(function(items) {
	    		    return RSVP.all(items.map(function(item) {
	    			return new Asana.Task(item.id).sync(
	    			    new Date(Date.parse(item.modified_at)));
	    		    }));
	    		}, rejectHandler),
	    	]).then(function() {
	    	    return this;
	    	}.bind(this), rejectHandler);
	    }.bind(this));
    },
    load: function() {
	var p = new Persistent(this.key);
	return p.exists(this.id).then(function(exists) {
	    if (exists) {
		return p.get(this.id).then(function(data) {
		    try {
			return $.extend(this, JSON.parse(data));
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date());
		    }
		}.bind(this), rejectHandler);
	    } else {
		return this.sync(new Date());
	    }
	}.bind(this), rejectHandler);
    },
    update: function(kvs) {
	return asana.request('/tags/' + this.id, kvs, 'PUT')
	    .then(function(data) {
		new Persistent('tasks').set(data.id, JSON.stringify(data));
		return data;
	    }, rejectHandler)
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this), rejectHandler);
    },
    Task: {
	find: function() {
	    return new Persistent(this.key + '/' + this.id).get('tasks')
		.then(function(data) {
		    try {
			return JSON.parse(data);
		    } catch (e) {
			console.log('Load error:', this.key, this.id);
			return this.sync(new Date(), true)
			    .then(function(item) {
				return item.Task.find();
			    });
		    }
		    return JSON.parse(data);
		}.bind(this), rejectHandler)
		.then(function(items) {
		    return RSVP.all(items.map(function(item) {
			return new Asana.Task(item.id).load();
		    }));
		}, rejectHandler);
	},
    },
}
