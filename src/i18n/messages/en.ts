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
  'widget.favorites': 'Favorites',
  'widget.notes': 'Notes',
  'widget.tasks': 'Tasks',
  'widget.focus': 'Focus timer',
  'widget.weather': 'Weather',

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
  'weather.addToClock': 'Add weather',
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
  'panel.face.none': 'None',
  'panel.face.off': 'Off',
  'panel.clockWeather': 'Show weather',
  'panel.clockWeatherLabel': 'Show weather beside the clock',
  'panel.clockWeatherNoRoom': 'Not shown with the {face} face.',

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
  'panel.widgetAbout.focus': 'One task and a timer',

  // Settings panel: language
  'panel.language.auto': 'Same as browser',
  'panel.language.note':
    'Same as browser follows your browser’s language when Tarn supports it, and English otherwise.',

  // Settings panel: advanced
  'panel.tab': 'Tab',
  'panel.tab.icon': 'Tab icon',
  'panel.tab.chrome': 'Chrome',
  'panel.tab.noteChrome': 'New tabs show Chrome’s own new-tab icon.',
  'panel.tab.noteNone': 'New tabs show no icon.',
  'panel.weather.provider': 'Provider',
  'panel.weather.providerLabel': 'Weather provider',
  'panel.weather.apiKey': 'API Key',
  'panel.weather.pasteKey': 'Paste key',
  'panel.weather.units': 'Units',
  'panel.weather.unitsLabel': 'Temperature units',
  'panel.weather.auto': 'Auto',
  'panel.weather.noteOpenMeteo':
    'Free, no key needed. Weather is only fetched for Weather widgets you add and the weather beside the clock, about every 30 minutes while a tab is open.',
  'panel.weather.noteGoogle':
    'Requests are billed to your key’s Google Cloud project, which needs the Weather API turned on. The key stays on this computer.',
  'panel.weather.keySaved': 'API key saved',
  'panel.weather.keyRemoved': 'API key removed',
  'panel.keys': 'Keyboard',
  'panel.keys.switch': 'Switch wallpaper',
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
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;

/** A complete translation: every key, as plain text. */
export type Catalog = Readonly<Record<MessageKey, string>>;
