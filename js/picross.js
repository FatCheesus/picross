$(function () {

	// localStorage save format versioning
	var saveVersion = '2019.08.03';

	var touchSupport = true;

	var PuzzleModel = Backbone.Model.extend({

		defaults: function () {
			return {
				dimensionWidth: 10,		// default dimension width
				dimensionHeight: 10,	// default dimension height
				state: [],
				hintsX: [],
				hintsY: [],
				guessed: 0,
				total: 100,
				complete: false,
				perfect: false,
				seed: 0,
				darkMode: false,
				easyMode: true,	// show crossouts
				difficulty: 'extreme',
				mistakes: 0
			};
		},

		initialize: function () {
			this.on('change', this.save);
		},

		save: function () {
			if (localStorageSupport()) {
				localStorage['picross2.saveVersion'] = saveVersion;

				localStorage['picross2.dimensionWidth'] = JSON.stringify(this.get('dimensionWidth'));
				localStorage['picross2.dimensionHeight'] = JSON.stringify(this.get('dimensionHeight'));
				localStorage['picross2.state'] = JSON.stringify(this.get('state'));
				localStorage['picross2.hintsX'] = JSON.stringify(this.get('hintsX'));
				localStorage['picross2.hintsY'] = JSON.stringify(this.get('hintsY'));
				localStorage['picross2.guessed'] = JSON.stringify(this.get('guessed'));
				localStorage['picross2.total'] = JSON.stringify(this.get('total'));
				localStorage['picross2.complete'] = JSON.stringify(this.get('complete'));
				localStorage['picross2.perfect'] = JSON.stringify(this.get('perfect'));
				localStorage['picross2.seed'] = JSON.stringify(this.get('seed'));
				localStorage['picross2.darkMode'] = JSON.stringify(this.get('darkMode'));
				localStorage['picross2.easyMode'] = JSON.stringify(this.get('easyMode'));
				localStorage['picross2.difficulty'] = JSON.stringify(this.get('difficulty'));
				localStorage['picross2.mistakes'] = JSON.stringify(this.get('mistakes'));
			}
		},

		resume: function () {

			if (!localStorageSupport() || localStorage['picross2.saveVersion'] != saveVersion) {
				this.reset();
				return;
			}

			var dimensionWidth = JSON.parse(localStorage['picross2.dimensionWidth']);
			var dimensionHeight = JSON.parse(localStorage['picross2.dimensionHeight']);
			var state = JSON.parse(localStorage['picross2.state']);
			var hintsX = JSON.parse(localStorage['picross2.hintsX']);
			var hintsY = JSON.parse(localStorage['picross2.hintsY']);
			var guessed = JSON.parse(localStorage['picross2.guessed']);
			var total = JSON.parse(localStorage['picross2.total']);
			var complete = JSON.parse(localStorage['picross2.complete']);
			var perfect = JSON.parse(localStorage['picross2.perfect']);
			var seed = JSON.parse(localStorage['picross2.seed']);
			var darkMode = JSON.parse(localStorage['picross2.darkMode']);
			var easyMode = JSON.parse(localStorage['picross2.easyMode']);
			var difficulty = localStorage['picross2.difficulty'] ? JSON.parse(localStorage['picross2.difficulty']) : 'extreme';
			var mistakes = localStorage['picross2.mistakes'] ? JSON.parse(localStorage['picross2.mistakes']) : 0;

			this.set({
				dimensionWidth: dimensionWidth,
				dimensionHeight: dimensionHeight,
				state: state,
				hintsX: hintsX,
				hintsY: hintsY,
				guessed: guessed,
				total: total,
				complete: complete,
				perfect: perfect,
				seed: seed,
				darkMode: darkMode,
				easyMode: easyMode,
				difficulty: difficulty,
				mistakes: mistakes
			});

			// Regenerate solution for validation
			Math.seedrandom(seed);
			var solution = [];
			for (var i = 0; i < dimensionHeight; i++) {
				solution[i] = [];
				for (var j = 0; j < dimensionWidth; j++) {
					solution[i][j] = Math.ceil(Math.random() * 2);
				}
			}
			this.solution = solution;
		},

		reset: function (customSeed) {

			var seed = customSeed;
			if (seed === undefined) {
				seed = '' + new Date().getTime();
			}
			Math.seedrandom(seed);

			var solution = [];
			var state = [];
			var total = 0;

			for (var i = 0; i < this.get('dimensionHeight'); i++) {
				solution[i] = [];
				state[i] = [];
				for (var j = 0; j < this.get('dimensionWidth'); j++) {
					var random = Math.ceil(Math.random() * 2);
					solution[i][j] = random;
					total += (random - 1);
					state[i][j] = 0;
				}
			}
			this.solution = solution;

			var hintsX = this.getHintsX(solution);
			var hintsY = this.getHintsY(solution);

			this.set({
				state: state,
				hintsX: hintsX,
				hintsY: hintsY,
				guessed: 0,
				total: total,
				complete: false,
				perfect: false,
				seed: seed,
				mistakes: 0
			}, { silent: true });
			this.trigger('change');
		},

		getHintsX: function (solution) {
			var hintsX = [];

			for (var i = 0; i < this.get('dimensionHeight'); i++) {
				var streak = 0;
				hintsX[i] = [];
				for (var j = 0; j < this.get('dimensionWidth'); j++) {
					if (solution[i][j] < 2) {
						if (streak > 0) {
							hintsX[i].push(streak);
						}
						streak = 0;
					}
					else {
						streak++;
					}
				}
				if (streak > 0) {
					hintsX[i].push(streak);
				}
			}

			return hintsX;
		},

		getHintsY: function (solution) {
			var hintsY = [];

			for (var j = 0; j < this.get('dimensionWidth'); j++) {
				var streak = 0;
				hintsY[j] = [];
				for (var i = 0; i < this.get('dimensionHeight'); i++) {
					if (solution[i][j] < 2) {
						if (streak > 0) {
							hintsY[j].push(streak);
						}
						streak = 0;
					}
					else {
						streak++;
					}
				}
				if (streak > 0) {
					hintsY[j].push(streak);
				}
			}

			return hintsY;
		},

		guess: function (x, y, guess) {
			var state = this.get('state');
			var guessed = this.get('guessed');

			if (state[x][y] === 2) {
				guessed--;
			}

			// Lock correct cells
			if (this.solution && state[x][y] === this.solution[x][y]) {
				return;
			}

			// Check for error (immediate failure or mistake count)
			if (this.solution && this.solution[x][y] !== guess) {
				var difficulty = this.get('difficulty');
				var mistakes = this.get('mistakes');

				// Easy Mode: Infinite mistakes, just highlight error (no level down)
				if (difficulty === 'easy') {
					this.trigger('failure', x, y); // Still highlight red
					return;
				}

				mistakes++;
				this.set({ mistakes: mistakes });

				// Default fail triggers
				var fail = false;
				if (difficulty === 'medium' && mistakes > 3) fail = true;
				if (difficulty === 'hard' && mistakes > 1) fail = true;
				if ((difficulty === 'extreme' || difficulty === 'impossible') && mistakes > 0) fail = true;

				if (fail) {
					this.trigger('failure', x, y);
				} else {
					// Just highlight red but don't fail level
					// Reuse 'failure' event but with a flag? 
					// Actually, Views listens to 'failure' and calls 'levelDown'.
					// We need a 'mistake' event probably?
					// Or change 'failure' handler in view to check if it should level down?
					// Let's repurpose 'failure' event to mean "Show Red X".
					// And add a 'levelDown' event? 
					// Or just let View check model state? View doesn't know "did I just fail?" efficiently.
					// Let's trigger 'mistake' for red highlight. 
					// And 'failure' for total failure.
					this.trigger('mistake', x, y);
				}
				return;
			}

			if (state[x][y] === guess) {
				state[x][y] = 0;
			} else {
				state[x][y] = guess;
				if (guess === 2) {
					guessed++;
				}
			}

			this.set({
				state: state,
				guessed: guessed
			}, { silent: true });

			// Auto win check
			if (guessed === this.get('total')) {
				this.set({
					complete: true,
					perfect: true
				});
			}

			this.updateCrossouts(state, x, y);
		},

		updateCrossouts: function (state, x, y) {
			var hintsX = this.get('hintsX');
			var hintsY = this.get('hintsY');

			// Check current row (X)
			var rowHints = hintsX[x];
			var rowData = state[x];
			hintsX[x] = this.checkLineCrossouts(rowHints, rowData);

			// Check current column (Y)
			var colHints = hintsY[y];
			var colData = [];
			for (var i = 0; i < state.length; i++) {
				colData.push(state[i][y]);
			}
			hintsY[y] = this.checkLineCrossouts(colHints, colData);

			this.set({
				hintsX: hintsX,
				hintsY: hintsY
			}, { silent: true });
			this.trigger('change');
		},

		// Helper to check crossouts for a single line (row/col)
		checkLineCrossouts: function (hints, line) {
			// hints: array of numbers (may be negative if already crossed out, but we recalculate each time)
			// line: array of cell states (0=unknown, 1=X, 2=Filled)

			// We need to return a new array of hints where crossed out ones are negative.
			// Logic:
			// 1. Forward Pass: Match hints from start. Stop at Unknown(0) or mismatch/unsecure.
			// 2. Backward Pass: Match hints from end. Stop at Unknown(0) or mismatch/unsecure.
			// 3. Union: Cross out value if Forward OR Backward marked it.

			var absHints = [];
			for (var i = 0; i < hints.length; i++) absHints.push(Math.abs(hints[i]));

			var forwardCrossed = []; // indices of hints crossed out
			var backwardCrossed = [];

			// --- Forward Pass ---
			var cellIndex = 0;
			var hintIndex = 0;

			while (hintIndex < absHints.length) {
				// Find next filled block
				// Skip Xs (1)
				// STOP at Unknown (0) -> because it might hide the block for *this* hint
				while (cellIndex < line.length && line[cellIndex] === 1) {
					cellIndex++;
				}

				if (cellIndex >= line.length) break; // End of line

				if (line[cellIndex] === 0) {
					// Hit unknown -> Cannot be sure about subsequent hints
					break;
				}

				if (line[cellIndex] === 2) {
					// Found a block. Does it match current hint?
					var currentStreak = absHints[hintIndex];
					var blockValid = true;

					// Check block length
					for (var k = 0; k < currentStreak; k++) {
						if (cellIndex + k >= line.length || line[cellIndex + k] !== 2) {
							blockValid = false;
							break;
						}
					}

					if (!blockValid) {
						break;
					}

					// Verify SECURE (Bounded by Start/X and End/X)
					var startIndex = cellIndex;
					var endIndex = cellIndex + currentStreak; // index AFTER block

					var startSecure = (startIndex === 0 || line[startIndex - 1] === 1);
					var endSecure = (endIndex === line.length || line[endIndex] === 1);

					if (startSecure && endSecure) {
						forwardCrossed.push(hintIndex);
						cellIndex = endIndex; // Move past block
						hintIndex++;
					} else {
						// Found match but not secure -> Stop
						break;
					}
				}
			}

			// --- Backward Pass ---
			cellIndex = line.length - 1;
			hintIndex = absHints.length - 1;

			while (hintIndex >= 0) {
				// Scan backwards
				while (cellIndex >= 0 && line[cellIndex] === 1) {
					cellIndex--;
				}

				if (cellIndex < 0) break;

				if (line[cellIndex] === 0) {
					break;
				}

				if (line[cellIndex] === 2) {
					var currentStreak = absHints[hintIndex];
					var blockValid = true;

					// Check block (backward from cellIndex)
					// Block is from [cellIndex - currentStreak + 1] to [cellIndex]
					var startIndex = cellIndex - currentStreak + 1;
					var endIndex = cellIndex + 1; // index AFTER block in standard terms

					if (startIndex < 0) {
						blockValid = false;
					} else {
						for (var k = startIndex; k < endIndex; k++) {
							if (line[k] !== 2) {
								blockValid = false;
								break;
							}
						}
					}

					if (!blockValid) {
						break;
					}

					// Verify SECURE
					var startSecure = (startIndex === 0 || line[startIndex - 1] === 1);
					var endSecure = (endIndex === line.length || line[endIndex] === 1);

					if (startSecure && endSecure) {
						backwardCrossed.push(hintIndex);
						cellIndex = startIndex - 1;
						hintIndex--;
					} else {
						break;
					}
				}
			}

			// Merge results
			var resultHints = [];
			for (var i = 0; i < absHints.length; i++) {
				var val = absHints[i];
				// If index i is in forward OR backward
				var isCrossed = false;

				// Check forward
				if (forwardCrossed.indexOf(i) !== -1) isCrossed = true;
				// Check backward
				if (backwardCrossed.indexOf(i) !== -1) isCrossed = true;

				if (isCrossed) {
					resultHints.push(-val);
				} else {
					resultHints.push(val);
				}
			}
			return resultHints;
		},

		_oldUpdateCrossouts: function (state, x, y) {


			// cross out row hints
			var filled = true;
			var cellIndex = 0;
			var hintIndex = 0;
			for (cellIndex; cellIndex < state[x].length;) {
				if (state[x][cellIndex] === 2) {
					if (hintIndex < hintsX[x].length) {
						var currentStreak = Math.abs(hintsX[x][hintIndex]);
						for (var i = 0; i < currentStreak; i++) {
							if (state[x][cellIndex] === 2) {
								cellIndex++;
							} else {
								filled = false;
								break;
							}
						}
						// If we failed in the middle of a block, break
						if (!filled) break;

						// SECURE CHECK:
						// Must be bounded by start (-1) or Empty (1)
						// AND bounded by end (length) or Empty (1)
						var startIndex = cellIndex - currentStreak;
						var endIndex = cellIndex; // Start of next

						var startSecure = (startIndex === 0 || state[x][startIndex - 1] === 1);
						var endSecure = (endIndex === state[x].length || state[x][endIndex] === 1);

						if (!startSecure || !endSecure) {
							// Not secured, but is it a valid block placement?
							// Even if valid, we don't cross it out yet for "Secure" mode.
							// But we need to increment hintIndex only if we "match" it?
							// The user wants crossout ONLY if secured.
							// If it's NOT secured, do we treat it as "not matched yet" (break loop) or just "matched but not crossed"?
							// If we treat as "matched but not crossed", we continue checking next hints?
							// But if we continue, we might cross out LATER hints.
							// Usually crossouts are sequential. If 1st is not crossed, 2nd cannot be.
							// So if not secured, we stop processing hints for this row -> filled = false.
							filled = false;
							break;
						}

						// Check if the block is followed by a filled cell (invalid block length)
						if (endIndex < state[x].length && state[x][endIndex] === 2) {
							filled = false;
							break;
						}
						hintIndex++;
					} else { // More filled blocks than hints
						filled = false;
						break;
					}
				} else {
					cellIndex++;
				}
			}

			for (var i = 0; i < hintsX[x].length; i++) {
				// Only cross out if we reached this hint index AND the loop finished successfully (filled=true) or logic implies up to hintIndex is valid?
				// My logic above breaks if !filled. So if !filled, hintIndex stops there.
				if (i < hintIndex) {
					hintsX[x][i] = -Math.abs(hintsX[x][i]);
				} else {
					hintsX[x][i] = Math.abs(hintsX[x][i]);
				}
			}

			// cross out column hints
			filled = true;
			cellIndex = 0;
			hintIndex = 0;
			for (cellIndex; cellIndex < state.length;) {
				if (state[cellIndex][y] === 2) {
					if (hintIndex < hintsY[y].length) {
						var currentStreak = Math.abs(hintsY[y][hintIndex]);
						for (var i = 0; i < currentStreak; i++) {
							if (cellIndex < state.length && state[cellIndex][y] === 2) {
								cellIndex++;
							} else {
								filled = false;
								break;
							}
						}
						if (!filled) break;

						// SECURE CHECK Y:
						var startIndex = cellIndex - currentStreak;
						var endIndex = cellIndex;

						var startSecure = (startIndex === 0 || state[startIndex - 1][y] === 1);
						var endSecure = (endIndex === state.length || state[endIndex][y] === 1);

						if (!startSecure || !endSecure) {
							filled = false;
							break;
						}

						if (endIndex < state.length && state[endIndex][y] === 2) {
							filled = false;
							break;
						}
						hintIndex++;
					} else {
						filled = false;
						break;
					}
				} else {
					cellIndex++;
				}
			}

			for (var i = 0; i < hintsY[y].length; i++) {
				if (i < hintIndex) {
					hintsY[y][i] = -Math.abs(hintsY[y][i]);
				} else {
					hintsY[y][i] = Math.abs(hintsY[y][i]);
				}
			}

			this.set({
				hintsX: hintsX,
				hintsY: hintsY
			}, { silent: true });
			this.trigger('change');
		}

	});

	var PuzzleView = Backbone.View.extend({

		el: $("body"),

		events: function () {
			if (touchSupport && 'ontouchstart' in document.documentElement) {
				return {
					"click #new": "newGame",
					"click #solve": "solve",
					"change #dark": "changeDarkMode",
					"change #easy": "changeEasyMode",
					"change #difficulty": "changeDifficulty",
					"mousedown": "clickStart",
					"mouseover td.cell": "mouseOver",
					"mouseout td.cell": "mouseOut",
					"mouseup": "clickEnd",
					"touchstart td.cell": "touchStart",
					"touchmove td.cell": "touchMove",
					"touchend td.cell": "touchEnd",
					"submit #customForm": "newCustom",
					"click #seed": function (e) { e.currentTarget.select(); },
					"click #customSeed": function (e) { e.currentTarget.select(); },
					"contextmenu": function (e) { e.preventDefault(); }
				}
			} else {
				return {
					"click #new": "newGame",
					"click #solve": "solve",
					"change #dark": "changeDarkMode",
					"change #easy": "changeEasyMode",
					"change #difficulty": "changeDifficulty",
					"mousedown": "clickStart",
					"mouseover td.cell": "mouseOver",
					"mouseout td.cell": "mouseOut",
					"mouseup": "clickEnd",
					"submit #customForm": "newCustom",
					"click #seed": function (e) { e.currentTarget.select(); },
					"click #customSeed": function (e) { e.currentTarget.select(); },
					"contextmenu": function (e) { e.preventDefault(); }
				}
			}
		},

		mouseStartX: -1,
		mouseStartY: -1,
		mouseEndX: -1,
		mouseEndY: -1,
		mouseMode: 0,

		initialize: function () {
			this.errorCoords = null;
			this.model.resume();
			$('#dimensions').val(this.model.get('dimensionWidth') + 'x' + this.model.get('dimensionHeight'));
			$('#difficulty').val(this.model.get('difficulty'));
			if (this.model.get('darkMode')) {
				$('#dark').attr('checked', 'checked');
			} else {
				$('#dark').removeAttr('checked');
			}
			if (this.model.get('easyMode')) {
				$('#easy').attr('checked', 'checked');
			} else {
				$('#easy').removeAttr('checked');
			}
			this.render();
			this.showSeed();

			this.model.on('failure', this.levelDown, this);
			this.model.on('mistake', this.showError, this);
			this.model.on('change:complete', this.checkLevelUp, this);
		},

		showError: function (x, y) {
			this.errorCoords = { x: x, y: y };
			var self = this;
			this.render();
			setTimeout(function () {
				self.errorCoords = null;
				self.render();
			}, 1000);
		},

		levelDown: function (x, y) {
			// Failure occurred. Highlight error.
			this.errorCoords = { x: x, y: y };
			this.render();

			// Safety check for easy mode (should not happen if model logic is correct, but good for safety)
			if (this.model.get('difficulty') === 'easy') {
				var self = this;
				setTimeout(function () {
					self.errorCoords = null;
					self.render();
				}, 1000);
				return;
			}

			// now we just wait and reset.
			var self = this;
			setTimeout(function () {
				self._performLevelDown();
			}, 1000);
		},

		_performLevelDown: function () {
			this.errorCoords = null;
			var $dims = $('#dimensions');
			var options = $dims.find('option');
			var currentVal = $dims.val();
			var currentIndex = 0;

			options.each(function (index) {
				if ($(this).val() === currentVal) {
					currentIndex = index;
				}
			});

			var nextIndex = Math.max(0, currentIndex - 1);
			if (nextIndex !== currentIndex) {
				$dims.prop('selectedIndex', nextIndex);
			}
			this.newGame();
		},

		checkLevelUp: function () {
			if (this.model.get('complete') && this.model.get('perfect')) {
				var $dims = $('#dimensions');
				var options = $dims.find('option');
				var currentVal = $dims.val();
				var currentIndex = 0;

				options.each(function (index) {
					if ($(this).val() === currentVal) {
						currentIndex = index;
					}
				});

				var nextIndex = Math.min(options.length - 1, currentIndex + 2);

				var self = this;
				setTimeout(function () {
					if (nextIndex !== currentIndex) {
						$dims.prop('selectedIndex', nextIndex);
					}
					self.newGame();
				}, 1500);
			}
		},

		changeDarkMode: function (e) {
			var darkMode = $('#dark').attr('checked') !== undefined;
			this.model.set({ darkMode: darkMode });
			this.render();
		},

		changeEasyMode: function (e) {
			var easyMode = $('#easy').attr('checked') !== undefined;
			this.model.set({ easyMode: easyMode });
			this.render();
		},

		changeDifficulty: function (e) {
			var difficulty = $('#difficulty').val();
			this.model.set({ difficulty: difficulty });
		},

		changeDimensions: function (e) {
			var dimensions = $('#dimensions').val();
			dimensions = dimensions.split('x');
			this.model.set({
				dimensionWidth: dimensions[0],
				dimensionHeight: dimensions[1]
			});
		},

		_newGame: function (customSeed) {
			$('#solve').prop('disabled', false);
			$('#puzzle').removeClass('complete');
			$('#puzzle').removeClass('perfect');
			$('#progress').removeClass('done');
			this.changeDimensions();
			this.model.reset(customSeed);
			this.render();
			this.showSeed();
		},

		newGame: function (e) {
			$('#customSeed').val('');
			this._newGame();
		},

		newCustom: function (e) {
			e.preventDefault();

			var customSeed = $.trim($('#customSeed').val());
			if (customSeed.length) {
				this._newGame(customSeed);
			} else {
				this._newGame();
			}
		},

		showSeed: function () {
			var seed = this.model.get('seed');
			$('#seed').val(seed);
		},

		clickStart: function (e) {
			if (this.model.get('complete')) {
				return;
			}

			var target = $(e.target);

			if (this.mouseMode != 0 || target.attr('data-x') === undefined || target.attr('data-y') === undefined) {
				this.mouseMode = 0;
				this.render();
				return;
			}

			if (e.which === 3 && this.model.get('difficulty') === 'impossible') {
				return; // Block right click
			}

			this.mouseStartX = target.attr('data-x');
			this.mouseStartY = target.attr('data-y');
			switch (e.which) {
				case 1:
					// left click
					e.preventDefault();
					this.mouseMode = 1;
					break;
				case 3:
					// right click
					e.preventDefault();
					this.mouseMode = 3;
					break;
			}
		},

		mouseOver: function (e) {
			var target = $(e.currentTarget);
			var endX = target.attr('data-x');
			var endY = target.attr('data-y');
			this.mouseEndX = endX;
			this.mouseEndY = endY;

			$('td.hover').removeClass('hover');
			$('td.hoverLight').removeClass('hoverLight');

			if (this.mouseMode === 0) {
				$('td.cell[data-y=' + endY + ']').addClass('hoverLight');
				$('td.cell[data-x=' + endX + ']').addClass('hoverLight');
				$('td.cell[data-x=' + endX + '][data-y=' + endY + ']').addClass('hover');
				return;
			}

			var startX = this.mouseStartX;
			var startY = this.mouseStartY;

			if (startX === -1 || startY === -1) {
				return;
			}

			var diffX = Math.abs(endX - startX);
			var diffY = Math.abs(endY - startY);

			if (diffX > diffY) {
				$('td.cell[data-x=' + endX + ']').addClass('hoverLight');
				var start = Math.min(startX, endX);
				var end = Math.max(startX, endX);
				for (var i = start; i <= end; i++) {
					$('td.cell[data-x=' + i + '][data-y=' + startY + ']').addClass('hover');
				}
			} else {
				$('td.cell[data-y=' + endY + ']').addClass('hoverLight');
				var start = Math.min(startY, endY);
				var end = Math.max(startY, endY);
				for (var i = start; i <= end; i++) {
					$('td.cell[data-x=' + startX + '][data-y=' + i + ']').addClass('hover');
				}
			}
		},

		mouseOut: function (e) {
			if (this.mouseMode === 0) {
				$('td.hover').removeClass('hover');
				$('td.hoverLight').removeClass('hoverLight');
			}
		},

		clickEnd: function (e) {
			if (this.model.get('complete')) {
				return;
			}

			try {
				var target = $(e.target);
				switch (e.which) {
					case 1:
						// left click
						e.preventDefault();
						if (this.mouseMode != 1) {
							this.mouseMode = 0;
							return;
						}
						if (target.attr('data-x') === undefined || target.attr('data-y') === undefined) {
							this.clickArea(this.mouseEndX, this.mouseEndY, 2);
						} else {
							this.clickArea(target.attr('data-x'), target.attr('data-y'), 2);
						}
						break;
					case 3:
						// right click
						e.preventDefault();
						if (this.mouseMode != 3) {
							this.mouseMode = 0;
							return;
						}
						if (target.attr('data-x') === undefined || target.attr('data-y') === undefined) {
							this.clickArea(this.mouseEndX, this.mouseEndY, 1);
						} else {
							this.clickArea(target.attr('data-x'), target.attr('data-y'), 1);
						}
						break;
				}
			} finally {
				this.mouseMode = 0;
				this.render();
			}
		},

		clickArea: function (endX, endY, guess) {
			var startX = this.mouseStartX;
			var startY = this.mouseStartY;

			if (startX === -1 || startY === -1) {
				return;
			}

			var diffX = Math.abs(endX - startX);
			var diffY = Math.abs(endY - startY);

			if (diffX > diffY) {
				for (var i = Math.min(startX, endX); i <= Math.max(startX, endX); i++) {
					this.model.guess(i, startY, guess);
				}
			} else {
				for (var i = Math.min(startY, endY); i <= Math.max(startY, endY); i++) {
					this.model.guess(startX, i, guess);
				}
			}
		},

		touchStart: function (e) {
			if (this.model.get('complete')) {
				return;
			}
			var target = $(e.target);
			this.mouseStartX = this.mouseEndX = e.originalEvent.touches[0].pageX;
			this.mouseStartY = this.mouseEndY = e.originalEvent.touches[0].pageY;
			var that = this;
			this.mouseMode = setTimeout(function () {
				that.model.guess(target.attr('data-x'), target.attr('data-y'), 1);
				that.render();
			}, 750);
		},

		touchMove: function (e) {
			if (this.model.get('complete')) {
				return;
			}
			this.mouseEndX = e.originalEvent.touches[0].pageX;
			this.mouseEndY = e.originalEvent.touches[0].pageY;
			if (Math.abs(this.mouseEndX - this.mouseStartX) >= 10 || Math.abs(this.mouseEndY - this.mouseStartY) >= 10) {
				clearTimeout(this.mouseMode);
			}
		},

		touchEnd: function (e) {
			if (this.model.get('complete')) {
				return;
			}
			clearTimeout(this.mouseMode);
			var target = $(e.target);
			if (Math.abs(this.mouseEndX - this.mouseStartX) < 10 && Math.abs(this.mouseEndY - this.mouseStartY) < 10) {
				this.model.guess(target.attr('data-x'), target.attr('data-y'), 2);
				this.render();
			}
		},

		solve: function () {
			if (this.model.get('complete')) {
				return;
			}

			var state = this.model.get('state');
			var hintsX = this.model.get('hintsX');
			var hintsY = this.model.get('hintsY');

			var perfect = true;
			var solutionX = this.model.getHintsX(state);
			var solutionY = this.model.getHintsY(state);

			for (var i = 0; i < hintsX.length; i++) {
				if (hintsX[i].length !== solutionX[i].length) {
					perfect = false;
					break;
				}
				for (var j = 0; j < hintsX[i].length; j++) {
					if (Math.abs(hintsX[i][j]) !== solutionX[i][j]) {
						perfect = false;
						break;
					}
				}
			}

			for (var i = 0; i < hintsY.length; i++) {
				if (hintsY[i].length !== solutionY[i].length) {
					perfect = false;
					break;
				}
				for (var j = 0; j < hintsY[i].length; j++) {
					if (Math.abs(hintsY[i][j]) !== solutionY[i][j]) {
						perfect = false;
						break;
					}
				}
			}

			this.model.set({
				complete: true,
				perfect: perfect,
				hintsX: hintsX,
				hintsY: hintsY
			});

			this.render();
		},

		render: function () {
			var progress = this.model.get('guessed') / this.model.get('total') * 100;
			$('#progress').text(progress.toFixed(1) + '%');

			if (this.model.get('darkMode')) {
				$('body').addClass('dark');
			} else {
				$('body').removeClass('dark');
			}

			if (this.model.get('complete')) {
				$('#solve').prop('disabled', true);
				$('#puzzle').addClass('complete');
				if (this.model.get('perfect')) {
					$('#progress').addClass('done');
					$('#puzzle').addClass('perfect');
				}
			}

			// Render Mistakes
			var mistakes = this.model.get('mistakes');
			var mistakesHtml = '';
			for (var k = 0; k < mistakes; k++) {
				mistakesHtml += '&#10006; '; // Heavy X
			}
			$('#mistakes').html(mistakesHtml);

			var state = this.model.get('state');
			var hintsX = this.model.get('hintsX');
			var hintsY = this.model.get('hintsY');

			var hintsXText = [];
			var hintsYText = [];
			if (this.model.get('easyMode') || this.model.get('complete')) {
				for (var i = 0; i < hintsX.length; i++) {
					hintsXText[i] = [];
					for (var j = 0; j < hintsX[i].length; j++) {
						if (hintsX[i][j] < 0) {
							hintsXText[i][j] = '<em>' + Math.abs(hintsX[i][j]) + '</em>';
						} else {
							hintsXText[i][j] = '<strong>' + hintsX[i][j] + '</strong>';
						}
					}
				}
				for (var i = 0; i < hintsY.length; i++) {
					hintsYText[i] = [];
					for (var j = 0; j < hintsY[i].length; j++) {
						if (hintsY[i][j] < 0) {
							hintsYText[i][j] = '<em>' + Math.abs(hintsY[i][j]) + '</em>';
						} else {
							hintsYText[i][j] = '<strong>' + hintsY[i][j] + '</strong>';
						}
					}
				}
			} else {
				for (var i = 0; i < hintsX.length; i++) {
					hintsXText[i] = [];
					for (var j = 0; j < hintsX[i].length; j++) {
						hintsXText[i][j] = '<strong>' + Math.abs(hintsX[i][j]) + '</strong>';
					}
				}
				for (var i = 0; i < hintsY.length; i++) {
					hintsYText[i] = [];
					for (var j = 0; j < hintsY[i].length; j++) {
						hintsYText[i][j] = '<strong>' + Math.abs(hintsY[i][j]) + '</strong>';
					}
				}
			}

			var html = '<table>';
			html += '<tr><td class="key"></td>';
			for (var i = 0; i < state[0].length; i++) {
				html += '<td class="key top">' + hintsYText[i].join('<br/>') + '</td>';
			}
			html += '</tr>';
			for (var i = 0; i < state.length; i++) {
				html += '<tr><td class="key left">' + hintsXText[i].join('') + '</td>';
				for (var j = 0; j < state[0].length; j++) {
					var cssClass = 'cell s' + Math.abs(state[i][j]);
					if (this.errorCoords && Number(this.errorCoords.x) === i && Number(this.errorCoords.y) === j) {
						cssClass += ' error';
					}
					html += '<td class="' + cssClass + '" data-x="' + i + '" data-y="' + j + '"></td>';
				}
				html += '</tr>';
			}
			html += '</table>';

			$('#puzzle').html(html);

			var side = (600 - (state[0].length * 5)) / state[0].length;
			$('#puzzle td.cell').css({
				width: side,
				height: side,
				fontSize: Math.ceil(200 / state[0].length)
			});
		}
	});

	new PuzzleView({ model: new PuzzleModel() });

});

function localStorageSupport() {
	try {
		return 'localStorage' in window && window['localStorage'] !== null;
	} catch (e) {
		return false;
	}
}
