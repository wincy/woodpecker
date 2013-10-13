define("asana", ["jquery", "ember", "when", "when/parallel", "when/sequence", "when/pipeline", "qunit", "sprintf", "asana/model", "asana/remote"], function($, Ember, when, parallel, sequence, pipeline, QUnit, sprintf, Model, Remote) {
    when.parallel = parallel;
    when.sequence = sequence;
    when.pipeline = pipeline;

    var CONCURRENCY = 6;

    function array_concat(s, l) {
	return s.concat(l);
    }

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

    Asana = Ember.Object.create();

    Asana.reopen({
	status: "ready",
    });

    Asana.reopen({
	User: Model.extends(
    	    ['user', 'users'], {
    		name: new Model.Field("string", true),
    		email: new Model.Field("string", true),
    	    }),
    });
    Asana.reopen({
	Subtask: Model.extends(
    	    ['task', 'tasks'], {
    		name: new Model.Field("string"),
    	    })
    });
    Asana.reopen({
	Task: Model.extends(
    	    ['task', 'tasks'], {
    		name: new Model.Field("string", true),
		completed: new Model.Field("string", true),
		assignee_status: new Model.Field("string", true),
    		Subtask: new Model.Field(Asana.Subtask),
		addTag: function(tag) {
		    return new Remote(this.constructor._plural + '/' + this.id)
			.create('addTag', {tag: tag.id});
		},
		removeTag: function(tag) {
		    return new Remote(this.constructor._plural + '/' + this.id)
			.create('removeTag', {tag: tag.id});
		},
		getAncestor: function() {
		    if (!this.parent) {
			return when.promise(function(resolve) {
			    resolve([]);
			});
		    } else {
			return Asana.Task.create({id: this.parent.id}).load()
			    .then(function(task) {
				return task.getAncestor().then(function(tasks) {
				    tasks.push(task);
				    return tasks;
				});
			    });
		    }
		},
		getOffspring: function() {
		    return when.all(when.map(this.Subtask.find(), function(item) {
			return Asana.Task.create({id: item.id}).getOffspring();
		    })).then(function(items) {
			if (items.length > 0) {
			    return [this, items];
			} else {
			    return this;
			}
		    }.bind(this));
		},
    	    })
    });
    Asana.reopen({
	Tag: Model.extends(
    	    ['tag', 'tags'], {
    		name: new Model.Field("string", true),
    		Task: new Model.Field(Asana.Task),
    	    })
    });
    Asana.Task.fields.Tag = new Model.Field(Asana.Tag);
    Asana.reopen({
	Project: Model.extends(
    	    ['project', 'projects'], {
    		name: new Model.Field("string", true),
    		Task: new Model.Field(Asana.Task),
    	    })
    });
    Asana.reopen({
	Workspace: Model.extends(
    	    ['workspace', 'workspaces'], {
    		name: new Model.Field("string", true),
    		User: new Model.Field(Asana.User),
    		Project: new Model.Field(Asana.Project),
    		Task: new Model.Field(Asana.Task),
    		Tag: new Model.Field(Asana.Tag),
    	    })
    });

    Asana.reopen({
	index: function() {
	    return when.all(when.map(Asana.Project.find(), function(project) {
		return when.all(
		    when.map(
			project.Task.find(),
			when.guard(
			    when.guard.n(CONCURRENCY),
			    function(task) {
				Asana.set('status', "index task " + task.id);
				return task.index();
			    })))
	    }));
	},
	sync: function() {
	    return when.sequence([
		function() {
		    var me = Asana.User.create({id: 'me'});
		    return me.sync();
		},
		// sync workspaces
		function() {
		    Asana.set('status', "sync workspaces");
		    return Asana.Workspace.sync();
		},
		function() {
		    return when.all(when.map(Asana.Workspace.find(), function(workspace) {
			Asana.set('status', "sync workspace " + workspace.id);
			return workspace.sync();
		    }));
		},
		function() {
		    return when.all(when.map(Asana.Workspace.find(), function(workspace) {
			Asana.set('status', "index workspace " + workspace.id);
			return workspace.index();
		    }));
		},
		// sync users
		function() {
		    Asana.set('status', "sync users");
		    return when.all([
			Asana.User.sync(),
			when.all(when.map(Asana.Workspace.find(), function(workspace) {
			    Asana.set('status', "sync users of workspace " + workspace.id);
			    return workspace.User.sync();
			})),
		    ]);
		},
		function() {
		    return when.all(when.map(Asana.User.find(), function(user) {
			Asana.set('status', "sync user " + user.id);
			return user.sync();
		    }));
		},
		function() {
		    return when.all(when.map(Asana.User.find(), function(user) {
			Asana.set('status', "index user " + user.id);
			return user.index();
		    }));
		},
		// sync projects
		function() {
		    Asana.set('status', "sync projects");
		    return when.all([
			Asana.Project.sync(),
			when.all(when.map(Asana.Workspace.find(), function(workspace) {
			    Asana.set('status', "sync projects of workspace " + workspace.id);
			    return workspace.Project.sync();
			})),
		    ]);
		},
		function() {
		    return when.all(when.map(Asana.Project.find(), function(project) {
			Asana.set('status', "sync project " + project.id);
			return project.sync();
		    }));
		},
		function() {
		    return when.all(when.map(Asana.Project.find(), function(project) {
			Asana.set('status', "index project " + project.id);
			return project.index();
		    }));
		},
		// sync tags
		function() {
		    Asana.set('status', "sync tags");
		    return when.pipeline([
			Asana.Tag.sync,
			function() {
			    return when.all(when.map(
				Asana.Workspace.find(), function(workspace) {
				    Asana.set('status', "sync tags of workspace " + workspace.id);
				    return workspace.Tag.sync();
				}));
			},
		    ]);
		},
		function() {
		    return when.all(when.map(Asana.Tag.find(), function(tag) {
			Asana.set('status', "sync tag " + tag.id);
			return tag.sync();
		    }));
		},
		function() {
		    return when.all(when.map(Asana.Tag.find(), function(tag) {
			Asana.set('status', "index tag " + tag.id);
			return tag.index();
		    }));
		},
		// sync tasks
		function() {
		    Asana.set('status', "sync tasks");
		    return when.all([
			when.all(when.map(
			    Asana.Workspace.find(),
			    when.guard(
				when.guard.n(CONCURRENCY),
				function(workspace) {
				    Asana.set('status', "sync tasks of workspace " + workspace.id);
				    return workspace.Task.sync();
				}))),
			when.all(when.map(
			    Asana.Project.find(), 
			    when.guard(
				when.guard.n(CONCURRENCY),
				function(project) {
				    Asana.set('status', "sync tasks of project " + project.id);
				    return project.Task.sync();
				}))),
			when.all(when.map(
			    Asana.Tag.find(),
			    when.guard(
				when.guard.n(CONCURRENCY),
				function(tag) {
				    Asana.set('status', "sync tasks of tag " + tag.id);
				    return tag.Task.sync();
				}))),
		    ]);
		},
		function() {
		    return when.pipeline([
			function() {
			    return when.all(when.map(Asana.Workspace.find(), function(workspace) {
				return when.all(
				    when.map(
					workspace.Task.find(),
					when.guard(
					    when.guard.n(CONCURRENCY),
					    function(task) {
						Asana.set('status', "sync task " + task.id);
						return task.sync().then(function(result) {
						    if (result) {
							return when.parallel([
							    function() {
								Asana.set('status', "sync subtasks of task " + task.id);
								return task.Subtask.sync();
							    },
							    function() {
								Asana.set('status', "index task " + task.id);
								return task.index();
							    },
							]);
						    } else {
							return null;
						    }
						});
					    })))
			    }))
			},
			function() {
			    return when.all(when.map(Asana.Project.find(), function(project) {
				return when.all(
				    when.map(
					project.Task.find(),
					when.guard(
					    when.guard.n(CONCURRENCY),
					    function(task) {
						Asana.set('status', "sync task " + task.id);
						return task.sync().then(function(result) {
						    if (result) {
							return when.parallel([
							    function() {
								Asana.set('status', "sync subtasks of task " + task.id);
								return task.Subtask.sync();
							    },
							    function() {
								Asana.set('status', "index task " + task.id);
								return task.index();
							    },
							]);
						    } else {
							return null;
						    }
						});
					    })))
			    }));
			},
			function() {
			    when.all(when.map(Asana.Tag.find(), function(tag) {
				return when.all(
				    when.map(
					tag.Task.find(),
					when.guard(
					    when.guard.n(CONCURRENCY),
					    function(task) {
						Asana.set('status', "sync task " + task.id);
						return task.sync().then(function(result) {
						    if (result) {
							return when.parallel([
							    function() {
								Asana.set('status', "sync subtasks of task " + task.id);
								return task.Subtask.sync();
							    },
							    function() {
								Asana.set('status', "index task " + task.id);
								return task.index();
							    },
							])
						    } else {
							return null;
						    }
						});
					    })))
			    }));
			},
		    ]);
		},
		// sync stories
		// function() {
		//     return when.all([
		// 	when.all(when.map(this.Workspace.find(), function(workspace) {
		// 	    return when.all(
		// 		when.map(
		// 		    workspace.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return task.Story.sync();
		// 			})))
		// 	})),
		// 	when.all(when.map(this.Project.find(), function(project) {
		// 	    return when.all(
		// 		when.map(
		// 		    project.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return task.Story.sync();
		// 			})))
		// 	})),
		//     ]);
		// }.bind(this),
		// function() {
		//     return when.all([
		// 	when.all(when.map(this.Workspace.find(), function(workspace) {
		// 	    return when.all(
		// 		when.map(
		// 		    workspace.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return when.map(
		// 				task.Story.find(),
		// 				when.guard(
		// 				    when.guard.n(CONCURRENCY),
		// 				    function(story) {
		// 					return story.sync();
		// 				    }));
		// 			})))
		// 	})),
		// 	when.all(when.map(this.Project.find(), function(project) {
		// 	    return when.all(
		// 		when.map(
		// 		    project.Task.find(),
		// 		    when.guard(
		// 			when.guard.n(CONCURRENCY),
		// 			function(task) {
		// 			    return when.map(
		// 				task.Story.find(),
		// 				when.guard(
		// 				    when.guard.n(CONCURRENCY),
		// 				    function(story) {
		// 					return story.sync();
		// 				    }));
		// 			})))
		// 	})),
		//     ]);
		// }.bind(this),
	    ]);
	},
    });

    Asana.reopen({
	test: function() {
    	    QUnit.asyncTest("Asana testing", function() {
    		when.pipeline([
		    Asana.sync,
    		    function() {
    			return Asana.Workspace.get({name: 'Test'})
			    .then(function(workspace) {
    				ok(workspace, "Workspace 'Test' exists");
				return workspace;
			    });
    		    },
    		    function(workspace) {
    			when.pipeline([
    			    // check project
    			    function() {
    				return true;
    			    },
    			    workspace.Project.find,
    			    function(projects) {
    				equal(projects.length, 1, "Only 1 project exists");
    				equal(projects[0].name, "project 0", "project name is 'project 0'");
    				return projects[0];
    			    },
    			    // check tasks
    			    function(project) {
    				return when.pipeline([
    				    function () {
    					return true;
    				    },
    				    project.Task.find,
    				    function(tasks) {
    					var names = tasks.map(function(task) {
    					    return task.name;
    					});
    					deepEqual(names.sort(),
    						  ['task 0',
    						   'task 0 subtask 0',
    						   'task 0 subtask 1',
    						   'task 0 subtask 2',
    						   'task 0 subtask 1 subtask 0',
    						   'task 0 subtask 1 subtask 1'].sort());
    				    },
    				]);
    			    },
    			    // check tags
    			    function() {
    				return true;
    			    },
			    workspace.Tag.sync,
    			    workspace.Tag.find,
    			    function(tags) {
    				equal(tags.length, 3, 'Only 3 tags exist');
    				var names = tags.map(function(tag) {
    				    return tag.name;
    				});
    				deepEqual(names.sort(),
    					  ['tag 0', 'tag 1', 'tag 2'].sort(),
    					  "tag list correct");
    				// check tag tasks
    				tag_tasks = {'tag 0': ['task 0'],
    					     'tag 1': ['task 0 subtask 0',
    						       'task 0 subtask 1 subtask 0'],
    					     'tag 2': ['task 0 subtask 1',
    						       'task 0 subtask 1 subtask 1']}
    				return when.all(when.map(tags, function(tag) {
    			    	    return when.pipeline([
    			    		function() {
    			    		    return true;
    			    		},
    			    		tag.Task.find,
    			    		function(tasks) {
    					    var names = tasks.map(function(task) {
    						return task.name;
    					    });
    					    deepEqual(
    						names.sort(),
    						tag_tasks[tag.name].sort(),
    						sprintf("tag '%s' task list correct",
    							tag.name));
    			    		}
    			    	    ]);
    				}));
    			    },
			    function() {
				return workspace.Tag.new({name: 'tag 4'})
				    .then(function(tag) {
					return workspace.Task.get({name: 'task 0'})
					    .then(function(task) {
						return task.addTag(tag).then(function() {
						    return task;
						});
					    });
				    });
			    },
			    function(task) {
				return when.pipeline([
				    task.Tag.sync,
				    task.Tag.find,
				    function(tags) {
					return when.all(when.map(tags, function(tag) {
					    return when.pipeline([
						tag.sync.bind(tag),
						tag.load.bind(tag),
					    ]);
					}));
				    },
				    function() {
					return task.Tag.get({name: 'tag 4'});
				    },
				    function(tag) {
					ok(tag, 'newly added tag');
					return tag;
				    },
				    function(tag) {
					return task.removeTag(tag);
				    },
				    task.Tag.sync,
				    task.Tag.find,
				    function(tags) {
					return when.all(when.map(tags, function(tag) {
					    return when.pipeline([
						tag.sync.bind(tag),
						tag.load.bind(tag),
					    ]);
					}));
				    },
				    function() {
					return task.Tag.get({name: 'tag 4'});
				    },
				    function(tag) {
					ok(tag == null, 'remove added tag');
				    },
				]);
			    },
    			    start,
    			], true);
    		    },
    		]);
    	    });
	},
    });

    return Asana;
})
