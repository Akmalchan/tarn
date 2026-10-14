/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Every word Tarn shows, in English: the source every translation follows.
 * Keys are grouped by where the words appear. `{name}` placeholders are
 * filled in by t(); keep them, in whatever order the language needs.
 * No plural forms: wording never depends on a count.
 */
export const en = {
  // Shared
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.add': 'Add',
  'common.remove': 'Remove',
  'common.settings': 'Settings',
  'common.openSettings': 'Open settings',

  // Widget names, also their default headings
  'widget.favorites': 'Bookmarks',
  'widget.notes': 'Notes',
  'widget.tasks': 'Tasks',
  'widget.focus': 'Timer',
  'widget.weather': 'Weather',
  'widget.calendar': 'Calendar',

  // Arranging widgets (settings open)
  'board.hint': 'Drag to rearrange · drag a corner to resize',
  'board.movable': 'movable widget',
  'board.position':
    '{name}, {index} of {count}. Drag, or use the arrow keys, to move it; plus and minus change its size.',
  'board.moved': '{name} moved to {position} of {count}.',
  'board.removed': '{name} removed.',
  'board.name': 'Name',
  'board.rename': 'Rename',
  'board.removeWidget': 'Remove {name}',
  'board.confirmRemove': 'Confirm removing {name}',
  'board.resized': 'Size of {name}: {size}.',

  // Notes
  'notes.placeholder': 'Write something…',

  // Tasks
  'tasks.add': 'Add a task',
  'tasks.new': 'New task',
  'tasks.task': 'Task',
  'tasks.done': 'Done',
  'tasks.notDone': 'Not done',

  // First content of the start widgets (widgets/start.ts)
  'start.note': 'Welcome to Tarn.\nWrite anything here.',

  // Focus timer
  'focus.title': 'Focus',
  'focus.start': 'Start',
  'focus.pause': 'Pause',
  'focus.resume': 'Resume',
  'focus.reset': 'Reset',
  'focus.break': 'Break time',
  'focus.timeLeft': 'Time left',
  'focus.length': 'Timer length, editable',
  'focus.change': 'Click to change',

  // Favorites
  'favorites.empty': 'Open settings to add your sites.',
  'favorites.addSite': 'Add a site',
  'favorites.editSite': 'Edit {title}',
  'favorites.removeSite': 'Remove {title}',
  'favorites.addTitle': 'Add a Site',
  'favorites.editTitle': 'Edit Site',
  'favorites.name': 'Name',
  'favorites.namePlaceholder': 'Shown under the icon',
  'favorites.address': 'Address',
  'favorites.badAddress': 'That doesn’t look like a web address.',
  'favorites.useBookmarks': 'Use my bookmarks',
  'favorites.useBookmarksHint': 'Copy the sites from your bookmarks bar',
  'favorites.noBookmarks': 'Your bookmarks bar is empty',
  'favorites.imported': 'Your bookmarks bar was added.',
  'favorites.more': 'More',
  'favorites.icon': 'Icon',
  'favorites.chooseIcon': 'Choose an image',
  'favorites.badIcon': 'That image can’t be used.',
  'favorites.folderLabel': 'Folder',
  'favorites.noFolder': 'None',
  'favorites.newFolder': 'New folder',
  'favorites.folder': 'Folder',
  'favorites.openFolder': 'Open {title}',
  'favorites.editFolder': 'Edit {title}',
  'favorites.folderName': 'Folder name',
  'favorites.removeFolder': 'Remove {title} and its sites',
  'favorites.confirmRemoveFolder': 'Confirm removing {title} and its sites',
  'favorites.movable': 'movable site',
  'favorites.moved': '{title} moved to {position} of {count}.',
  'favorites.movedInto': '{title} moved into {folder}.',

  // Weather
  'weather.empty': 'See the weather where you are, or anywhere.',
  'weather.choose': 'Choose a Place',
  'weather.change': 'Change place',
  'weather.city': 'City',
  'weather.search': 'Search for a city',
  'weather.useLocation': 'Use My Location',
  'weather.myLocation': 'My Location',
  'weather.privacy':
    'City search goes to Open-Meteo. Forecasts come from {provider}. Only the place you choose is sent, rounded to about a kilometer, and only to get its weather.',
  'weather.providerGoogle': 'Google, with your API key',
  'weather.noPlaces': 'No places by that name.',
  'weather.cantSearch': 'Can’t search right now.',
  'weather.locationDenied':
    'Location wasn’t allowed. You can search for a city instead.',
  'weather.finding': 'Finding you…',
  'weather.locationFailed':
    'Couldn’t find your location. Try searching instead.',
  'weather.now': 'Now',
  'weather.today': 'Today',
  'weather.highLow': 'H {high} L {low}',
  'weather.by': 'Weather by',
  'weather.checkKey': 'Check the Google API key in Settings',
  'weather.unavailable': 'Can’t get the weather right now',
  'weather.offline': 'Offline · updated {hours} h ago',
  'weather.clear': 'Clear',
  'weather.partly': 'Partly cloudy',
  'weather.cloudy': 'Cloudy',
  'weather.fog': 'Fog',
  'weather.drizzle': 'Drizzle',
  'weather.rain': 'Rain',
  'weather.sleet': 'Sleet',
  'weather.snow': 'Snow',
  'weather.storm': 'Thunderstorm',
  'weather.wind': 'Windy',
  'calendar.previous': 'Previous month',
  'calendar.next': 'Next month',
  'calendar.today': 'Today',

  // Toolbar popup
  'popup.newTab': 'Tarn new tab',
  'popup.on': 'New tabs open Tarn.',
  'popup.off': 'New tabs open the default page.',
  'popup.takeover': 'Other new tab taking over?',
  'popup.fix': 'Fix it →',
  'popup.firefox':
    'In Firefox, turn Tarn off from Add-ons and themes (about:addons).',

  // Switching off other new-tab extensions
  'takeover.permissionTitle': 'Make Tarn your new tab',
  'takeover.permissionBody':
    'Only one extension can control the new tab page. Tarn can switch the others off for you, and switch them back on whenever you turn Tarn off.',
  'takeover.allow': 'Allow Tarn to manage extensions',
  'takeover.denied': 'Permission was not granted. You can try again anytime.',
  'takeover.confirmNote':
    'Your browser will ask you to confirm. Tarn only switches extensions on or off when you ask it to.',
  'takeover.doneTitle': 'Tarn is your new tab',
  'takeover.doneBody':
    'The selected extensions are switched off. Turn Tarn off from its toolbar button anytime and they come back.',
  'takeover.openNewTab': 'Open a new tab',
  'takeover.clearTitle': 'All clear',
  'takeover.clearBody':
    'No other extensions are switched on, so Tarn already owns the new tab.',
  'takeover.chooseTitle': 'Switch off other new tabs',
  'takeover.chooseBody':
    'The ones that look like new-tab extensions are already selected. Turning Tarn off later switches them back on.',
  'takeover.newTabTag': 'New tab',
  'takeover.switchOff': 'Switch off and use Tarn',

  // Settings panel: shared
  'panel.search': 'Search',
  'panel.searchSettings': 'Search settings',
  'panel.searchWallpapers': 'Search Wallpapers',
  'panel.searchClocks': 'Search Clocks',
  'panel.noSettings': 'No settings match “{query}”.',
  'panel.noWallpapers': 'No wallpapers match “{query}”.',
  'panel.noClocks': 'No clocks match “{query}”.',
  'panel.results': 'Results',
  'panel.undo': 'Undo',
  'panel.none': 'None',
  'panel.showAll': 'Show All',

  // Settings panel: page titles
  'panel.page.wallpapers': 'Wallpapers',
  'panel.page.clock': 'Clock',
  'panel.page.widgets': 'Widgets',
  'panel.page.language': 'Language',
  'panel.page.advanced': 'Advanced',

  // Settings panel: home
  'panel.wallpaper': 'Wallpaper',
  'panel.clock': 'Clock',
  'panel.for': 'for {browser}',
  'panel.version': 'Version {version}',
  'panel.privacy': 'Privacy',
  'panel.source': 'Source code',

  // Settings panel: clock faces
  'panel.face.center': 'Classic',
  'panel.face.bold': 'Bold',
  'panel.face.minimal': 'Minimal',
  'panel.face.serif': 'Serif',
  'panel.face.stacked': 'Stacked',
  'panel.face.outline': 'Outline',
  'panel.face.pixel': 'Pixel',
  'panel.face.glass': 'Glass',
  'panel.face.rounded': 'Rounded',
  'panel.face.analog': 'Analog',
  'panel.face.flip': 'Flip',
  'panel.face.lcd': 'LCD',
  'panel.face.neon': 'Neon',
  'panel.face.fraktur': 'Fraktur',
  'panel.face.gotisch': 'Gotisch',
  'panel.face.none': 'None',
  'panel.face.off': 'Off',

  // Settings panel: wallpapers and photos
  'panel.addPhoto': 'Add Photo…',
  'panel.yourPhotos': 'Your Photos',
  'panel.live': 'Live',
  'panel.photo': 'Photo',
  'panel.deletePhoto': 'Delete',
  'panel.deletePhotoNamed': 'Delete {name}',
  'panel.photoAdded': 'Added to Your Photos',
  'panel.photoDeleted': '{name} deleted',
  'panel.photoNotImage': 'That file isn’t an image.',
  'panel.photoTooLarge': 'That image is too large (over 50 MB).',
  'panel.photoCantOpen': 'That image couldn’t be opened.',
  'panel.photoCantAdd': 'That image couldn’t be added.',

  // Settings panel: widgets
  'panel.widgets.onTab': 'On your tab',
  'panel.widgets.dragNote':
    'While this panel is open, drag widgets on your tab to move them.',
  'panel.widgets.empty':
    'No widgets. The page stays calm: just the wallpaper and the clock.',
  'panel.widgets.add': 'Add a widget',
  'panel.widgets.full': 'That’s the most a page can hold.',
  'panel.widgets.added': '{name} added',
  'panel.widgets.removed': '{name} removed',
  'panel.widgets.nameOf': 'Name of {name}',
  'panel.widgets.sizeOf': '{name} size',
  'panel.size.s': 'Small',
  'panel.size.m': 'Medium',
  'panel.size.l': 'Large',
  'panel.size.xl': 'Extra large',
  'panel.widgetAbout.favorites': 'Your sites, one click away',
  'panel.widgetAbout.notes': 'A note that stays on this computer',
  'panel.widgetAbout.tasks': 'A short to-do list',
  'panel.widgetAbout.weather': 'Today and the week ahead',
  'panel.widgetAbout.calendar': 'This month at a glance',
  'panel.widgetAbout.focus': 'One task and a timer',

  // Settings panel: language
  'panel.language.auto': 'Same as browser',
  'panel.language.note':
    'Same as browser follows your browser’s language when Tarn supports it, and English otherwise.',

  // Settings panel: advanced
  'panel.tab': 'Tab',
  'panel.tab.icon': 'Tab icon',
  'panel.tab.noteNone': 'New tabs show no icon.',
  'panel.weather.provider': 'Provider',
  'panel.weather.providerLabel': 'Weather provider',
  'panel.weather.apiKey': 'API Key',
  'panel.weather.pasteKey': 'Paste key',
  'panel.weather.units': 'Units',
  'panel.weather.unitsLabel': 'Temperature units',
  'panel.weather.auto': 'Auto',
  'panel.weather.noteOpenMeteo':
    'Free, no key needed. Weather is only fetched for Weather widgets you add, about every 30 minutes while a tab is open.',
  'panel.weather.noteGoogle':
    'Requests are billed to your key’s Google Cloud project, which needs the Weather API turned on. The key stays on this computer.',
  'panel.weather.keySaved': 'API key saved',
  'panel.weather.keyRemoved': 'API key removed',
  'panel.keys': 'Keyboard',
  'panel.keys.shortcuts': 'Keyboard shortcuts',
  'panel.backup': 'Backup',
  'panel.backup.export': 'Export Backup',
  'panel.backup.import': 'Import Backup',
  'panel.backup.reset': 'Reset to defaults',
  'panel.backup.confirm': 'Click again',
  'panel.backup.note':
    'A backup is one .json file with your settings and what’s in your widgets. Reset restores the wallpaper, clock, widgets and tab icon. None of these turns Tarn on or off.',
  'panel.backup.search': 'Back up and restore',
  'panel.backup.saved': 'Backup saved',
  'panel.backup.cantSave': 'The backup couldn’t be saved',
  'panel.backup.notBackup': 'That file isn’t a Tarn backup',
  'panel.backup.imported': 'Backup imported',
  'panel.previous': 'Previous Setups',
  'panel.previous.app': 'Tarn {version}',
  'panel.previous.note':
    'Tarn keeps your setup from before each of its last updates. Click one to go back to it.',
  'panel.previous.restored': 'Setup restored',
  'panel.json.file': 'settings.json',
  'panel.json.hint': 'Edit, then apply. Invalid values fall back to defaults.',
  'panel.json.apply': 'Apply',
  'panel.json.applied': 'Applied.',
  'panel.json.invalid': 'Not valid JSON: {error}',
  'panel.about': 'About',
  'panel.about.version': 'Version',
  'panel.about.diagnostics': 'Copy diagnostics',
  'panel.about.diagnosticsNote':
    'Copies the version, browser and settings, for bug reports.',
  'panel.about.copied': 'Diagnostics copied',
  'panel.about.cantCopy': 'Couldn’t copy. Use settings.json instead.',
  'panel.about.search': 'Version and diagnostics',

  // Settings polish (2026-10-14)
  'panel.searchWidgets': 'Search Widgets',
  'panel.searchLanguages': 'Search Languages',
  'panel.noWidgets': 'No widgets match “{query}”.',
  'panel.noLanguages': 'No languages match “{query}”.',
  'panel.widgets.addHint': 'Drag one onto your page, or click to add it.',
  'panel.load': 'Load on your computer: {level}',
  'panel.load.still': 'none, it’s a still image',
  'panel.load.light': 'light',
  'panel.load.medium': 'medium',
  'panel.load.heavy': 'higher',
  'panel.examples': 'Example setups',
  'panel.examples.note':
    'Try a ready-made page with sample content. Undo brings your own widgets back.',
  'panel.examples.shown': '{name} shown',
  'panel.examples.bookmarks': 'Just bookmarks',
  'panel.examples.notes': 'Notes and tasks',
  'panel.examples.starter': 'Starter',
  'panel.examples.planner': 'Planner',
  'panel.examples.everything': 'Everything',
  'panel.examples.folderWork': 'Work',
  'panel.examples.folderLearn': 'Learn',
  'panel.examples.task1': 'Reply to messages',
  'panel.examples.task2': 'Book the dentist',
  'panel.examples.task3': 'Water the plants',
  'panel.tab.browser': 'Browser',
  'panel.tab.custom': 'Your own',
  'panel.tab.change': 'Change image',
  'panel.tab.noteBrowser': 'New tabs show your browser’s own new-tab icon.',
  'panel.tab.noteCustom':
    'New tabs show your image. It stays on this computer.',
  'panel.tab.badImage': 'That image can’t be used.',

  // Search box
  'panel.page.search': 'Search',
  'panel.search.box': 'Search box',
  'panel.search.show': 'Show',
  'panel.search.hide': 'Hide',
  'panel.search.shown': 'On',
  'panel.search.hidden': 'Off',
  'panel.search.boxNote':
    'Under the clock, like your browser’s own. Searches go to your browser’s search engine.',
  'panel.search.buttons': 'Buttons',
  'panel.search.voice': 'Voice search',
  'panel.search.lens': 'Google Lens',
  'panel.search.ai': 'AI Mode',
  'panel.search.on': 'On',
  'panel.search.off': 'Off',
  'panel.search.buttonsNote':
    'Nothing is sent until you press one. Voice turns your speech into text through your browser, which sends it to Google. Lens sends an image to Google Lens only when you drop, pick or paste one. AI Mode opens your question in Google’s AI Mode.',
  'search.placeholder': 'Search or type a URL',
  'search.voice': 'Search by voice',
  'search.lens': 'Search with Google Lens',
  'search.openSite': 'Open site',
  'search.searchWeb': 'Search the web',
  'panel.search.style': 'Look',
  'panel.search.auto': 'Auto',
  'panel.search.light': 'Light',
  'panel.search.dark': 'Dark',
  'panel.search.glass': 'Glass',
  'search.aiMode': 'AI Mode',
  'search.close': 'Close',
  'search.lensTitle': 'Search any image with Google Lens',
  'search.lensDrop': 'Drag an image here or',
  'search.lensUpload': 'upload a file',
  'search.lensOr': 'OR',
  'search.lensLink': 'Paste image link',
  'search.lensSearch': 'Search',
  'search.lensBadLink': 'That doesn’t look like an image link.',
  'search.lensNotImage': 'That file isn’t an image.',
  'search.speakNow': 'Speak now',
  'search.stopListening': 'Stop listening',
  'search.noSpeech': 'Didn’t catch that.',
  'search.voiceFailed': 'Voice search isn’t working right now.',
  'search.micDenied': 'Tarn can’t use the microphone.',
  'search.micDeniedHint':
    'Allow it for Tarn in your browser’s site settings, then try again.',
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;

/** A complete translation: every key, as plain text. */
export type Catalog = Readonly<Record<MessageKey, string>>;
