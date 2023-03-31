// @ts-DOnocheck
//import * as angular from "angular";

// FileSaver
declare const saveAs: any;

interface savedTab {
	url: string;
	index: number;
	rule: string;
	protocol: string;
	state: string;
	regex: string | null;
}

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

	$scope.checkInputBox = async function(warningBox: HTMLElement, tabUrlInput: HTMLInputElement) {
		if ( (tabUrlInput.value.startsWith('https://') || tabUrlInput.value.startsWith('http://'))) {
			warningBox.style.display = "block";
			warningBox.textContent = protocolInURLMessage;
		} else {
			warningBox.textContent = "";
			warningBox.style.display = "none";
		}
		// Check for dupe tabs
		if ($scope.savedTabs.some(function(tab: savedTab) { return tab.url === tabUrlInput.value })) {
			warningBox.style.display = "block";
			warningBox.textContent = duplicateTab;
		}
	}

	const protocolInURLMessage='Please enter URL without the protocol - i.e. example.com, not https://example.com.'
	const duplicateTab='Tab already exists!'
	// TODO remove hack after rewrite
if (location.pathname.split("/").slice(-1)[0] !== 'popup.html') {
		const tabUrlInput = document.getElementById('tabUrl');
		const warningBox = document.getElementById('warningBox');
		if (!tabUrlInput) {
			alert('Could not find element with ID tabUrl!')
			return
		}
		if (!warningBox) {
			alert('Could not find element with ID warningBox!')
			return
		}
		tabUrlInput.addEventListener("input", function() {
			$scope.checkInputBox()
		});
	}


	async function getPinnedTabs() {
		let queryOptions = { pinned: true };
		let tabs = await chrome.tabs.query(queryOptions);
		return tabs;
	}

	async function getSavedTabs(): Promise<savedTab[]> {
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
		const tabUrlInput = document.getElementById('tabUrl') as HTMLInputElement;
		if (!tabUrlInput) {
			alert('Could not find element with ID tabUrl')
			return
		}
		const tabUrl = tabUrlInput.value;
		const dropdownProtocolButton = document.getElementById('dropbtn-protocol-button');
		if (!dropdownProtocolButton) {
			alert('Could not find element with ID dropbtn-protocol-button')
			return
		}
		let protocol = dropdownProtocolButton.textContent;
		let ruleType = '';

		const selectedRadioButton = document.querySelector('input[name="choice"]:checked');
		if (selectedRadioButton) {
			if(!selectedRadioButton.parentNode) { alert('Something is deeply broken, no parent for radio button'); return }
			const selectedLabel = selectedRadioButton.parentNode.querySelector('label');
			if (!selectedLabel ) {
				alert('Could not find label element')
				return
			} else if (selectedLabel.textContent === null) {
				alert('Label text is null')
				return
			}
			ruleType = selectedLabel.textContent;
		}

		let regex = 'null';
		if (ruleType === 'Regex') {
			const regexInput = document.getElementById('regex-input') as HTMLInputElement
			if(!regexInput) {
				alert('Could not find label element with ID regex-input')
				return
			}
			regex = regexInput.value;
		}

		if ( (tabUrl.startsWith('https://') || tabUrl.startsWith('http://'))) {
			alert(protocolInURLMessage)
			return
		}
		if ($scope.savedTabs.some(function(tab: savedTab) { return tab.url === tabUrl })) {
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
			$scope.savedTabs.sort((a: savedTab, b: savedTab) => a.index - b.index);
			chrome.storage.sync.set({ savedTabs: $scope.savedTabs }, () => {
				console.log('Tab URL saved:', tabUrl);
				tabUrlInput.value = '';
			});
		}
	};

	$scope.editTab = async function(tab: savedTab) {
		// TODO - actually make this into an edit function instead of a copy one
		const tabUrlInput = document.getElementById("tabUrl") as HTMLInputElement
		const buttonProtocol = document.getElementById("dropbtn-protocol-button")
		if (!buttonProtocol) {
			alert('Could not find element with ID dropbtn-protocol-button')
			return
		}

		const labels = document.querySelectorAll('label')
		labels.forEach(label => {
			if (label.textContent === tab.rule) {
				const beforeLabel = label.previousElementSibling as HTMLInputElement
				beforeLabel.checked = true
			}
		});

		const regexContainer = document.getElementById("regex-container")
		if (!regexContainer) {
			alert('Could not find element with ID regex-container')
			return
		}
		const regexInput = document.getElementById("regex-input") as HTMLInputElement
		if (!regexInput) {
			alert('Could not find element with ID regex-input')
			return
		}
		if (tab.rule === 'Regex' && tab.regex !== null) {
			regexInput.value = tab.regex
			regexContainer.style.visibility = 'visible'
		} else {
			regexContainer.style.visibility = 'hidden'
		}
		const exactMatchOption = ruleOptions.find(option => option.option === tab.rule)
		if (!exactMatchOption) {
			alert('Could not find a match for rule: ' + tab.rule)
			return
		}

		const ruleTypeDesc = document.getElementById("rule-type-desc")
		if (!ruleTypeDesc) {
			alert('Could not find element with ID rule-type-desc')
			return
		}
		ruleTypeDesc.innerHTML = exactMatchOption.desc

		tabUrlInput.value = tab.url
		buttonProtocol.textContent = tab.protocol
		await $scope.checkInputBox()
	}

	$scope.removeTab = async function(tab: savedTab) {
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
		await $scope.checkInputBox()
	};

	$scope.removeAllTabs = async function() {
		while ($scope.savedTabs.length > 0) {
			let tab = $scope.savedTabs[0];
			$scope.removeTab(tab);
			console.log('Removed tab:', tab.url);
		}
	};

	// TODO - fix the ANY here, it's a list of browser tabs
	$scope.getOpenTabByURL = async function(url: string, tabList: any, rule: string, regexString: string) {
		// Iterate each tab and verify if it matches one in the provided list
		for (let tabIndex in tabList) {
			let tab = tabList[tabIndex]
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

				let regex = new RegExp(regexString)
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
	if (location.pathname.split("/").slice(-1)[0] != 'popup.html') {
		let defaultRule = "Loose"
		const exactMatchOption = ruleOptions.find(option => option.option === defaultRule);
		const ruleTypeDesc = document.getElementById("rule-type-desc")
		if (!ruleTypeDesc) {
			alert('Could not find element with ID rule-type-desc')
			return
		}
		if (!exactMatchOption) {
			alert('Could not find a rule match for option: ' + defaultRule)
			return
		}
		ruleTypeDesc.innerHTML = exactMatchOption.desc;

		const rulesBox = document.getElementById("rule-rectangle-box");
		if (!rulesBox) {
			alert('Could not find element with ID rule-rectangle-box')
			return
		}
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
					ruleTypeDesc.innerHTML = option.desc;
					const regexContainer = document.getElementById("regex-container")
					if (!regexContainer) {
						alert('Could not find element with ID regex-container')
						return
					}
					if (option.option === 'Regex') {
						regexContainer.style.visibility = 'visible'
					} else {
						regexContainer.style.visibility = 'hidden'
					}
				}
			});
			rulesBox.appendChild(div);
		});

		const labels = document.querySelectorAll('label');
		labels.forEach(label => {
			if (label.textContent === defaultRule) {
				const beforeLabel = label.previousElementSibling as HTMLInputElement
				beforeLabel.checked = true
			}
		});


		const dropdownContentProtocols = document.getElementById("protocol-options");
		if (!dropdownContentProtocols) {
			alert('Could not find element with ID protocol-options')
			return
		}
		const dropdownProtocolButton = document.getElementById('dropbtn-protocol-button');
		if (!dropdownProtocolButton) {
			alert('Could not find element with ID dropbtn-protocol-button')
			return
		}
		protocolOptions.forEach(option => {
			const a = document.createElement("a");
			a.href = "#";
			a.textContent = option.option;
			a.addEventListener("click", () => {
				dropdownProtocolButton.innerHTML = option.option;
				dropdownContentProtocols.style.display = 'none';
			});
			dropdownContentProtocols.appendChild(a);
		});
		dropdownProtocolButton.addEventListener('mouseover', function() {
			dropdownContentProtocols.style.display = '';
		});
	}


	$scope.toggleEnableState = async function(savedTab: savedTab) {
		let savedTabs = await getSavedTabs();
//		console.log(savedTab)
//		console.log(savedTab.state)
//		console.log(savedTab.index)
//		console.log(savedTabs[savedTab.index].state)

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
			let existingTab = await $scope.getOpenTabByURL(savedTab.protocol + savedTab.url, pinnedTabs, savedTab.rule, savedTab.regex)
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
		if (typeof browser === 'undefined') {
			const extensionId = chrome.runtime.id;
			urlToOpen = `chrome-extension://${extensionId}/options.html`;
		} else {
			const browserInfo = await browser.runtime.getBrowserInfo()
			if (browserInfo.name === 'Firefox') {
				const manifest = browser.runtime.getManifest()
				if (!manifest.options_ui) {
					alert('manifest.options_ui is undefined!')
					return
				}
				urlToOpen = manifest.options_ui.page;
			} else {
				alert('Unsupported browser: ' + browserInfo.name)
			}
		}
		let openTabs = await chrome.tabs.query({})
		const openTab = await $scope.getOpenTabByURL(urlToOpen, openTabs, 'Loose');
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
			const file = input.files ? input.files[0] : null;
			if (!file) {
				alert('Error loading settings file');
				return;
			}
			const reader = new FileReader();
			reader.readAsText(file);
			reader.onload = function() {
				const data = JSON.parse(reader.result as string);
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
		const donateURL = 'https://www.patreon.com/C0rn3j';
		chrome.tabs.create({ url: donateURL });
	}

	$scope.donatePaypal = async function() {
		const donateURL = 'https://paypal.me/MartinRys';
		chrome.tabs.create({ url: donateURL });
	}

	$scope.init();
}]);
