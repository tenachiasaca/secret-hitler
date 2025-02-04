const { CURRENTSEASONNUMBER } = require('../../src/frontend-scripts/node-constants');
const Account = require('../../models/account');
const ModAction = require('../../models/modAction');
const BannedIP = require('../../models/bannedIP');

const fs = require('fs');
const PNG = require('pngjs').PNG;
let emotes = [];
fs.readdirSync('public/images/emotes', { withFileTypes: true }).forEach(file => {
	if (file.name.endsWith('.png')) emotes[emotes.length] = [file.name.substring(0, file.name.length - 4), file];
});

// Ordered list of sizes, used for good packing of images with a fixed size.
// It will also not go over 10 in a given dimension (making 10x10 the max), to avoid sizes like 23x1 (resorting 6x4 instead).
// If multiple options exist, it will pick the more square option, and prefers images to be wider instead of taller.
// Sizes below 20 are also not included, as we should always have at least that many emotes.
const sizeMap = [
	[5, 4], // 20
	[6, 4], // 24
	[5, 5], // 25
	[9, 3], // 27
	[7, 4], // 28
	[6, 5], // 30
	[8, 4], // 32
	[7, 5], // 35
	[6, 6], // 36
	[8, 5], // 40
	[7, 6], // 42
	[9, 5], // 45
	[8, 6], // 48
	[10, 5], // 50
	[9, 6], // 54
	[8, 7], // 56
	[10, 6], // 60
	[9, 7], // 63
	[8, 8], // 64
	[10, 7], // 70
	[9, 8], // 72
	[10, 8], // 80
	[9, 9], // 81
	[10, 9], // 90
	[10, 10] // 100
];

const numEmotes = emotes.length;
let sheetSize = [10, 10];
sizeMap.forEach(size => {
	const space = size[0] * size[1];
	if (space >= numEmotes && space < sheetSize[0] * sheetSize[1]) sheetSize = size;
});

let curCell = 0;
const result = new PNG({
	width: sheetSize[0] * 28,
	height: sheetSize[1] * 28,
	filter: -1
});
let numDone = 0;
const incrementEmote = () => {
	numDone++;
	if (numDone == numEmotes) result.pack().pipe(fs.createWriteStream('./public/images/emotesheet.png'));
};
emotes.forEach(emote => {
	const thisCell = curCell;
	curCell++;
	const loc = [thisCell % sheetSize[0], Math.floor(thisCell / sheetSize[0])];
	const img = new PNG();
	img.parse(fs.readFileSync(`public/images/emotes/${emote[1].name}`)).on('parsed', () => {
		PNG.bitblt(img, result, 0, 0, 28, 28, loc[0] * 28, loc[1] * 28);
		incrementEmote();
	});
	emote[1] = loc;
});

module.exports.emoteList = emotes;

const games = {};
module.exports.games = games;
module.exports.userList = [];
module.exports.generalChats = {
	sticky: '',
	list: []
};
module.exports.accountCreationDisabled = { status: false };
module.exports.ipbansNotEnforced = { status: false };
module.exports.gameCreationDisabled = { status: false };
module.exports.limitNewPlayers = { status: false };
module.exports.newStaff = {
	modUserNames: [],
	editorUserNames: [],
	altmodUserNames: [],
	trialmodUserNames: [],
	contributorUserNames: []
};

const staffList = [];
Account.find({ staffRole: { $exists: true } }).then(accounts => {
	accounts.forEach(user => (staffList[user.username] = user.staffRole));
});

module.exports.getPowerFromRole = role => {
	if (role === 'admin') return 3;
	if (role === 'editor') return 2;
	if (role === 'moderator') return 1;
	if (role === 'altmod') return 0; // Report AEM delays will check for >= 0
	if (role === 'trialmod') return 0;
	if (role === 'contributor') return -1;
	return -1;
};

module.exports.getPowerFromName = name => {
	if (module.exports.newStaff.editorUserNames.includes(name)) return getPowerFromRole('editor');
	if (module.exports.newStaff.modUserNames.includes(name)) return getPowerFromRole('moderator');
	if (module.exports.newStaff.altmodUserNames.includes(name)) return getPowerFromRole('altmod');
	if (module.exports.newStaff.trialmodUserNames.includes(name)) return getPowerFromRole('trialmod');
	if (module.exports.newStaff.contributorUserNames.includes(name)) return getPowerFromRole('contributor');

	const user = module.exports.userList.find(user => user.userName === name);
	if (user) return getPowerFromRole(user.staffRole);
	else if (staffList[name]) return getPowerFromRole(staffList[name]);
	else return -1;
};

module.exports.getPowerFromUser = user => {
	if (module.exports.newStaff.editorUserNames.includes(user.userName)) return getPowerFromRole('editor');
	if (module.exports.newStaff.modUserNames.includes(user.userName)) return getPowerFromRole('moderator');
	if (module.exports.newStaff.altmodUserNames.includes(user.userName)) return getPowerFromRole('altmod');
	if (module.exports.newStaff.trialmodUserNames.includes(user.userName)) return getPowerFromRole('trialmod');
	if (module.exports.newStaff.contributorUserNames.includes(user.userName)) return getPowerFromRole('contributor');
	return getPowerFromRole(user.staffRole);
};

// set of profiles, no duplicate usernames
/**
 * @return // todo
 */
module.exports.profiles = (() => {
	const profiles = [];
	const MAX_SIZE = 100;
	const get = username => profiles.find(p => p._id === username);
	const remove = username => {
		const i = profiles.findIndex(p => p._id === username);
		if (i > -1) return profiles.splice(i, 1)[0];
	};
	const push = profile => {
		if (!profile) return profile;
		remove(profile._id);
		profiles.unshift(profile);
		profiles.splice(MAX_SIZE);
		return profile;
	};

	return { get, push };
})();

module.exports.formattedUserList = isAEM => {
	const prune = value => {
		// Converts things like zero and null to undefined to remove it from the sent data.
		return value ? value : undefined;
	};

	return module.exports.userList
		.map(user => ({
			userName: user.userName,
			wins: prune(user.wins),
			losses: prune(user.losses),
			rainbowWins: prune(user.rainbowWins),
			rainbowLosses: prune(user.rainbowLosses),
			isPrivate: prune(user.isPrivate),
			staffDisableVisibleElo: prune(user.staffDisableVisibleElo),
			staffDisableStaffColor: prune(user.staffDisableStaffColor),

			// Tournaments are disabled, no point sending this.
			// tournyWins: user.tournyWins,

			// Blacklists are sent in the sendUserGameSettings event.
			// blacklist: user.blacklist,
			customCardback: user.customCardback,
			customCardbackUid: user.customCardbackUid,
			eloOverall: user.eloOverall ? Math.floor(user.eloOverall) : undefined,
			eloSeason: user.eloSeason ? Math.floor(user.eloSeason) : undefined,
			status: user.status && user.status.type && user.status.type != 'none' ? user.status : undefined,
			winsSeason: prune(user[`winsSeason${CURRENTSEASONNUMBER}`]),
			lossesSeason: prune(user[`lossesSeason${CURRENTSEASONNUMBER}`]),
			rainbowWinsSeason: prune(user[`rainbowWinsSeason${CURRENTSEASONNUMBER}`]),
			rainbowLossesSeason: prune(user[`rainbowLossesSeason${CURRENTSEASONNUMBER}`]),
			previousSeasonAward: user.previousSeasonAward,
			specialTournamentStatus: user.specialTournamentStatus,
			timeLastGameCreated: user.timeLastGameCreated,
			staffRole: prune(user.staffRole),
			staffIncognito: prune(user.staffIncognito),
			isContributor: prune(user.isContributor)
			// oldData: user
		}))
		.filter(user => isAEM || !user.staffIncognito);
};

const userListEmitter = {
	state: 0,
	send: false,
	timer: setInterval(() => {
		// 0.01s delay per user (1s per 100), always delay
		if (!userListEmitter.send) {
			userListEmitter.state = module.exports.userList.length / 10;
			return;
		}
		if (userListEmitter.state > 0) userListEmitter.state--;
		else {
			userListEmitter.send = false;
			io.sockets.emit('fetchUser'); // , {
			// 	list: module.exports.formattedUserList()
			// });
		}
	}, 100)
};

module.exports.userListEmitter = userListEmitter;

module.exports.formattedGameList = () => {
	return Object.keys(module.exports.games).map(gameName => ({
		name: games[gameName].general.name,
		flag: games[gameName].general.flag,
		userNames: games[gameName].publicPlayersState.map(val => val.userName),
		customCardback: games[gameName].publicPlayersState.map(val => val.customCardback),
		customCardbackUid: games[gameName].publicPlayersState.map(val => val.customCardbackUid),
		gameStatus: games[gameName].gameState.isCompleted
			? games[gameName].gameState.isCompleted
			: games[gameName].gameState.isTracksFlipped
			? 'isStarted'
			: 'notStarted',
		seatedCount: games[gameName].publicPlayersState.length,
		gameCreatorName: games[gameName].general.gameCreatorName,
		minPlayersCount: games[gameName].general.minPlayersCount,
		maxPlayersCount: games[gameName].general.maxPlayersCount || games[gameName].general.minPlayersCount,
		excludedPlayerCount: games[gameName].general.excludedPlayerCount,
		casualGame: games[gameName].general.casualGame || undefined,
		eloMinimum: games[gameName].general.eloMinimum || undefined,
		isVerifiedOnly: games[gameName].general.isVerifiedOnly || undefined,
		isTourny: games[gameName].general.isTourny || undefined,
		timedMode: games[gameName].general.timedMode || undefined,
		flappyMode: games[gameName].general.flappyMode || undefined,
		flappyOnlyMode: games[gameName].general.flappyOnlyMode || undefined,
		tournyStatus: (() => {
			if (games[gameName].general.isTourny) {
				if (games[gameName].general.tournyInfo.queuedPlayers && games[gameName].general.tournyInfo.queuedPlayers.length) {
					return {
						queuedPlayers: games[gameName].general.tournyInfo.queuedPlayers.length
					};
				}
			}
			return undefined;
		})(),
		experiencedMode: games[gameName].general.experiencedMode || undefined,
		disableChat: games[gameName].general.disableChat || undefined,
		disableGamechat: games[gameName].general.disableGamechat || undefined,
		blindMode: games[gameName].general.blindMode || undefined,
		enactedLiberalPolicyCount: games[gameName].trackState.liberalPolicyCount,
		enactedFascistPolicyCount: games[gameName].trackState.fascistPolicyCount,
		electionCount: games[gameName].general.electionCount,
		rebalance6p: games[gameName].general.rebalance6p || undefined,
		rebalance7p: games[gameName].general.rebalance7p || undefined,
		rebalance9p: games[gameName].general.rerebalance9p || undefined,
		privateOnly: games[gameName].general.privateOnly || undefined,
		private: games[gameName].general.private || undefined,
		uid: games[gameName].general.uid,
		rainbowgame: games[gameName].general.rainbowgame || undefined,
		isCustomGame: games[gameName].customGameSettings.enabled,
		isUnlisted: games[gameName].general.unlisted || undefined
	}));
};

const gameListEmitter = {
	state: 0,
	send: false,
	timer: setInterval(() => {
		// 3 second delay, instant send
		if (gameListEmitter.state > 0) gameListEmitter.state--;
		else {
			if (!gameListEmitter.send) return;
			gameListEmitter.send = false;
			io.sockets.emit('gameList', module.exports.formattedGameList());
			gameListEmitter.state = 30;
		}
	}, 100)
};

module.exports.gameListEmitter = gameListEmitter;

module.exports.AEM = Account.find({ staffRole: { $exists: true } });

const bypassKeys = [];

module.exports.verifyBypass = key => {
	return bypassKeys.indexOf(key) >= 0;
};

module.exports.consumeBypass = (key, user, ip) => {
	const idx = bypassKeys.indexOf(key);
	if (idx >= 0) {
		bypassKeys.splice(idx, 1);
		new ModAction({
			date: new Date(),
			modUserName: '',
			userActedOn: user,
			modNotes: `Bypass key used: ${key}`,
			ip: ip,
			actionTaken: 'bypassKeyUsed'
		}).save();
	}
};

module.exports.createNewBypass = () => {
	let key;
	do {
		key = `${Math.random()
			.toString(36)
			.substring(2)}${Math.random()
			.toString(36)
			.substring(2)}`.trim();
	} while (bypassKeys.indexOf(key) >= 0);
	bypassKeys.push(key);
	return key;
};

// There's a mountain of "new" type bans.
const unbanTime = new Date() - 64800000;
BannedIP.deleteMany({ type: 'new', bannedDate: { $lte: unbanTime } }, (err, r) => {
	if (err) throw err;
});
const banLength = {
	small: 18 * 60 * 60 * 1000, // 18 hours
	new: 18 * 60 * 60 * 1000, // 18 hours
	tiny: 1 * 60 * 60 * 1000, // 1 hour
	big: 7 * 24 * 60 * 60 * 1000 // 7 days
};
module.exports.testIP = (IP, callback) => {
	if (!IP) callback('Bad IP!');
	else if (module.exports.ipbansNotEnforced.status) callback(null);
	else {
		BannedIP.find({ ip: IP }, (err, ips) => {
			if (err) callback(err);
			else {
				let date;
				let unbannedTime;
				const ip = ips.sort((a, b) => b.bannedDate - a.bannedDate)[0];

				if (ip) {
					date = Date.now();
					unbannedTime = ip.bannedDate.getTime() + (banLength[ip.type] || banLength.big);
				}

				if (ip && unbannedTime > date) {
					if (process.env.NODE_ENV === 'production') {
						callback(ip.type, unbannedTime);
					} else {
						console.log(`IP ban ignored: ${IP} = ${ip.type}`);
						callback(null);
					}
				} else {
					callback(null);
				}
			}
		});
	}
};
