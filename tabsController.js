angular.module('tabsApp').controller('TabsController', ['$scope', function($scope) {
	$scope.sortableOptions = {
		stop: function() {
			for (let i = 0; i < $scope.savedTabs.length; i++) {
				$scope.savedTabs[i].index = i;
			}
			chrome.storage.sync.set({ savedTabs: $scope.savedTabs }, () => {
				console.log('Tabs order updated');
			});
		}
	};

	$scope.savedTabs = [];

	$scope.init = async function() {
			$scope.savedTabs = await getSavedTabs();
			$scope.$apply();
//			console.log($scope.savedTabs)
	};

	checkInputBox = async function() {
		if ( (tabUrlInput.value.startsWith('https://') || tabUrlInput.value.startsWith('http://'))) {
			warningBox.style.display = "block";
			warningBox.textContent = protocolInURLMessage;
		} else {
			warningBox.textContent = "";
			warningBox.style.display = "none";
		}
		// Check for dupe tabs
		let tabUrl = document.getElementById('tabUrl').value;
		if ($scope.savedTabs.some(function(tab) { return tab.url === tabUrl })) {
			warningBox.style.display = "block";
			warningBox.textContent = duplicateTab;
		}
	}

	const tabUrlInput = document.getElementById("tabUrl");
	const warningBox = document.getElementById("warningBox");
	const protocolInURLMessage='Please enter URL without the protocol - i.e. example.com, not https://example.com.'
	const duplicateTab='Tab already exists!'
	// TODO remove hack after rewrite
	if (location.pathname.split("/").slice(-1) != 'popup.html') {
		tabUrlInput.addEventListener("input", function() {
			checkInputBox()
		});
	}


	async function getPinnedTabs() {
		let queryOptions = { pinned: true };
		let tabs = await chrome.tabs.query(queryOptions);
		return tabs;
	}

	async function getSavedTabs() {
		return new Promise((resolve) => {
				chrome.storage.sync.get('savedTabs', ({ savedTabs }) => {
						if (!savedTabs) {
								savedTabs = [];
								chrome.storage.sync.set({ savedTabs });
						}
						// Make sure to migrate to new settings if user is using old format
						let migrationState = false
						for (let savedTabIndex in savedTabs) {
							const savedTab = savedTabs[savedTabIndex]
							// Exact used to be named Exact Match in <=0.1.2
							if (savedTab.rule == 'Exact match') {
								savedTab.rule = 'Exact'
								migrationState = true
							}
							// If migration occurred, save new state
							if (migrationState) {
								chrome.storage.sync.set({ savedTabs });
								console.log('Migrated settings to new version')
							}
						}
						resolve(savedTabs);
				});
		});
	}


	$scope.saveTab = async function() {
		let tabUrl = document.getElementById('tabUrl').value;
		let protocol = document.getElementById('dropbtn-protocol-button').textContent;
		let ruleType = '';
		let regex = null;

		const selectedRadioButton = document.querySelector('input[name="choice"]:checked');
		if (selectedRadioButton) {
			const selectedLabel = selectedRadioButton.parentNode.querySelector('label');
			ruleType = selectedLabel.textContent;
		}

		if (ruleType === 'Regex') {
			regex = document.getElementById('regex-input').value;
		}

		if ( (tabUrl.startsWith('https://') || tabUrl.startsWith('http://'))) {
			alert(protocolInURLMessage)
			return
		}
		if ($scope.savedTabs.some(function(tab) { return tab.url === tabUrl })) {
			alert("Tab already exists!" + tabUrl)
			return
		}
		if (tabUrl) {
			if (protocol == '' || ruleType == '') {
				alert('ERROR, empty protocol (' + protocol + ') or rule type(' + ruleType + ')')
				return
			}
			let index = $scope.savedTabs.length;

			let tab = { url: tabUrl, index: index, rule: ruleType, protocol: protocol, state: 'Enabled', regex: regex || null };
			$scope.savedTabs.push(tab);
			$scope.savedTabs.sort((a, b) => a.index - b.index);
			chrome.storage.sync.set({ savedTabs: $scope.savedTabs }, () => {
				console.log('Tab URL saved:', tabUrl);
				document.getElementById('tabUrl').value = '';
			});
		}
	};

	$scope.editTab = async function(tab) {
		// TODO - actually make this into an edit function instead of a copy one
		const tabUrlInput = document.getElementById("tabUrl");
		const regexInput = document.getElementById("regex-input");
		const buttonProtocol = document.getElementById("dropbtn-protocol-button")

		const labels = document.querySelectorAll('label');
		labels.forEach(label => {
			if (label.textContent === tab.rule) {
				label.previousElementSibling.checked = true
			}
		});

		if (tab.rule === 'Regex') {
			regexInput.value = tab.regex
			document.getElementById("regex-container").style.visibility = 'visible'
		} else {
			document.getElementById("regex-container").style.visibility = 'hidden'
		}
		const exactMatchOption = ruleOptions.find(option => option.option === tab.rule);
		document.getElementById("rule-type-desc").innerHTML = exactMatchOption.desc;

		tabUrlInput.value = tab.url;
		buttonProtocol.textContent = tab.protocol
		await checkInputBox()
	};

	$scope.removeTab = async function(tab) {
		let index = $scope.savedTabs.indexOf(tab);
		if (index > -1) {
			$scope.savedTabs.splice(index, 1);
			for (let i = index; i < $scope.savedTabs.length; i++) {
				$scope.savedTabs[i].index -= 1;
			}
			chrome.storage.sync.set({ savedTabs: $scope.savedTabs }, () => {
				console.log('Tab URL removed:', tab.url);
			});
		}
		await checkInputBox()
	};

	$scope.removeAllTabs = async function() {
		while ($scope.savedTabs.length > 0) {
			let tab = $scope.savedTabs[0];
			$scope.removeTab(tab);
			console.log('Removed tab:', tab.url);
		}
	};

	getOpenTabByURL = async function(url, tabList, rule, regex) {
		// Iterate each tab and verify if it matches one in the provided list
		for (tabIndex in tabList) {
			tab = tabList[tabIndex]
			// If a tab is in the middle of loading, it has pendingUrl with the URL that is being loaded, so check both current and pending URLs
			if (rule === 'Exact') {
//				console.log("Comparison:", tab.url + '   ' + url);
				if (tab.url == url || (tab.pendingUrl && tab.pendingUrl == url )) {
//					console.log('Found a match:' + tab.url);
					return tab
				}
			} else if (rule === 'Loose') {
				if (tab.url.startsWith(url) || (tab.pendingUrl && tab.pendingUrl.startsWith(url) )) {
//					console.log('Found a match:' + tab.url);
					return tab
				}
			} else if (rule === 'Regex') {

				regex = new RegExp(regex)
				if (regex.test(tab.url)) {
					return tab
				}
			} else {
				alert('Unimplemented rule ' + rule)
				return false
			}
		}
		return false
	}

	const ruleOptions = [
		{ option: "Loose", desc: "Matches any URL that begins with the same path, for example:<br>\"reddit.com\" will match both \"reddit.com\" and \"reddit.com/r/cars\"" },
		{ option: "Regex", desc: 'Matches the target URL based on a regular expression, for example to open a specific Slack channel, but not open a new tab if you switch to a different channel' },
		{ option: "Exact", desc: "Exactly matches the target URL, for example:<br>\"reddit.com\" will match \"reddit.com\" but not \"reddit.com/home\"" }
	];
	const protocolOptions = [
		{ option: "https://" },
		{ option: "http://" },
		{ option: "file://" }
	];

	// TODO remove if hack after rewrite
	if (location.pathname.split("/").slice(-1) != 'popup.html') {
		defaultRule = "Loose"
		const exactMatchOption = ruleOptions.find(option => option.option === defaultRule);
		document.getElementById("rule-type-desc").innerHTML = exactMatchOption.desc;

		const rulesBox = document.getElementById("rule-rectangle-box");
		ruleOptions.forEach(option => {
			const div = document.createElement("div");
			div.classList.add("rule-rectangle-box-component");
			const input = document.createElement("input");
			input.type = "radio";
			input.name = "choice";
			input.value = option.option;

			const label = document.createElement("label");
			label.textContent = option.option;
			label.classList.add("rule-option-text")

			div.appendChild(input);
			div.appendChild(label);

			div.addEventListener("change", () => {
				if (input.checked) {
					document.getElementById("rule-type-desc").innerHTML = option.desc;
					if (option.option === 'Regex') {
						document.getElementById("regex-container").style.visibility = 'visible'
					} else {
						document.getElementById("regex-container").style.visibility = 'hidden'
					}
				}
			});
			rulesBox.appendChild(div);
		});

		const labels = document.querySelectorAll('label');
		labels.forEach(label => {
			if (label.textContent === defaultRule) {
				label.previousElementSibling.checked = true
			}
		});


		const dropdownContentProtocols = document.getElementById("protocol-options");
		protocolOptions.forEach(option => {
			const a = document.createElement("a");
			a.href = "#";
			a.textContent = option.option;
			a.addEventListener("click", () => {
				document.getElementById("dropbtn-protocol-button").innerHTML = option.option;
				dropdownContentProtocols.style.display = 'none';
			});
			dropdownContentProtocols.appendChild(a);
		});
		document.getElementById("dropbtn-protocol-button").addEventListener('mouseover', function() {
			dropdownContentProtocols.style.display = '';
		});
	}


	$scope.toggleEnableState = async function(savedTab) {
		console.log(savedTab)
		console.log(savedTab.state)
		let savedTabs = await getSavedTabs();
		console.log(savedTab.index)
		console.log(savedTabs[savedTab.index].state)

		if (savedTab.state == 'Enabled') {
			savedTabs[savedTab.index].state = 'Disabled'
		} else {
			savedTabs[savedTab.index].state = 'Enabled'
		}
		chrome.storage.sync.set({ savedTabs: savedTabs }, () => {
			console.log('Tab state updated');
		});
		$scope.savedTabs = savedTabs;
		$scope.$apply();
	}
	$scope.syncTabs = async function() {
		let pinnedTabs = await getPinnedTabs();
		let savedTabs = await getSavedTabs();
		// for (tab in pinnedTabs) {
		// 	console.log('Currently pinned: ' + pinnedTabs[tab].url);
		// }

		let disabledTabLoopAmount = 0;
		// Iterate for each tab that is supposed to exist
		for (let savedTabIndex in savedTabs) {
			const savedTab = savedTabs[savedTabIndex]
//			console.log(savedTab)
			if (savedTab.state == 'Disabled') {
				disabledTabLoopAmount = disabledTabLoopAmount + 1
				continue
			}
			let existingTab = await getOpenTabByURL(savedTab.protocol + savedTab.url, pinnedTabs, savedTab.rule, savedTab.regex)
//			console.log(existingTab)
			// If the tab doesn't exist already, create it
			if (!existingTab) {
				console.log('Opening: ' + savedTab.protocol + savedTab.url);
				chrome.tabs.create({
					"url": savedTab.protocol + savedTab.url,
					"pinned": true,
					"active": false,
					"index": savedTab.index
				});
			} else if (savedTab.index - disabledTabLoopAmount != existingTab.index) {
				chrome.tabs.move(existingTab.id, {index: savedTab.index - disabledTabLoopAmount})
			}
		}
	}

	$scope.goToSettings = async function() {
		let urlToOpen = ''
		// If browser does not exist, we are definitely not in Chromium-based browsers, and we only currently support Firefox
		if (!browser) {
			const extensionId = chrome.runtime.id;
			urlToOpen = `chrome-extension://${extensionId}/options.html`;
		} else {
			const browserInfo = await browser.runtime.getBrowserInfo()
			if (browserInfo.name === 'Firefox') {
				const manifest = await browser.runtime.getManifest()
				urlToOpen = manifest.options_ui.page;
			} else {
				alert('Unsupported browser: ' + browserInfo.name)
			}
		}
		let openTabs = await chrome.tabs.query({})
		const openTab = await getOpenTabByURL(urlToOpen, openTabs, 'Loose');
		// Open new settings window if it didn't exist before
		if (! openTab) {
			chrome.tabs.create({ url: urlToOpen });
			return
		}
		// Focus existing window if it exists
		if (! openTab.selected) {
			chrome.tabs.update(openTab.id, {selected:true})
		}
		// This is only called from popup.html, so close the window
		window.close();
	};

	$scope.exportSettings = async function() {
		chrome.storage.sync.get(null, function(items) {
			const serialized = JSON.stringify(items);
			// TODO - maybe switch to type: "application/json;charset=utf-8"?
			const blob = new Blob([serialized], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const event = new Date();
			// Get a date string that looks like "2023-03-20_11-06-34"
			const dateString = event.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, -5);
			const fileName = 'immortal-pins_' + dateString + '.json'
			saveAs(blob, fileName);
		})
	};

	$scope.importSettings = async function() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';
		input.onchange = function() {
			const file = input.files[0];
			const reader = new FileReader();
			reader.readAsText(file);
			reader.onload = function() {
				const data = JSON.parse(reader.result);
				chrome.storage.sync.set(data, function() {
					console.log('Imported data:', data);
					// Reload savedTabs
					getSavedTabs().then(function(tabs) {
						$scope.savedTabs = tabs;
						$scope.$apply();
					});
				});
			};
		};
		input.click();
	};

	$scope.donatePatreon = async function() {
		donateURL = 'https://www.patreon.com/C0rn3j';
		chrome.tabs.create({ url: donateURL });
	}

	$scope.donatePaypal = async function() {
		donateURL = 'https://paypal.me/MartinRys';
		chrome.tabs.create({ url: donateURL });
	}

	$scope.init();
}]);