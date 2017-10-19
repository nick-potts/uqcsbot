// Description
//   Welcomes new users to UQCS Slack and check for member milestones

var API_LIMIT = 200;        // Number of members to get at a time
var MEMBER_MILESTONE = 50;  // Number of members between posting a celebration
var MESSAGE_PAUSE = 2500;   // Number of seconds between sending bot messages
var WELCOME_MESSAGES = [    // Welcome messages sent to new members
    "Hey there! Welcome to the UQCS slack!",
    "This is the first time I've seen you, so you're probably new here",
    "I'm UQCSbot, your friendly (open source) robot helper",
    "We've got a bunch of generic channels (e.g. #banter, #games, #projects) along with many subject-specific ones",
    "Your friendly admins are @trm, @mitch, @rob, @mb, @csa, @guthers, and @artemis",
    "Type \"help\" here, or \"!help\" anywhere else to find out what I can do!",
    "and again, welcome :)"
];

function getNumMembers(robot, room, numMembers, cursor) {
    // No more members to get, return the final count
    if (cursor == "") {
        return Promise.resolve(numMembers);
    }

    // Request for next batch of users
    options = {limit: API_LIMIT, cursor: cursor};
    return robot.adapter.client.web.conversations.members(announcements, options).then(res => {
        // Create a list of promises that resolve to each member's status
        var memberPromises = res.members.map(id => {
            return robot.adapter.client.web.users.info(id)
                .then(user => (user.deleted) ? 0 : 1);
            });

        // Count this batch of users, filtering out all who are deleted, and request next batch
        nextCursor = res.response_metadata.next_cursor;
        return Promise.all(memberPromises)
            .then(statuses => statuses.reduce((a, b) => a + b, 0))
            .then(count => getNumMembers(robot, announcements, numMembers + count, nextCursor));
    });
}

module.exports = function (robot) {
    robot.enter(function (res) {
        // Make sure we have access to all the clients we need
        if(!robot.adapter.client || !robot.adapter.client.rtm || !robot.adapter.client.web) {
            return;
        }

        // Check if user has entered #announcements channel
        var announcements = robot.adapter.client.rtm.dataStore.getChannelByName("announcements").id; 
        if (res.message.room != announcements) {
            return;
        }
        
        // Welcome new user to #general
        var general = robot.adapter.client.rtm.dataStore.getChannelByName("general").id; 
        name = res.message.user.profile.display_name || res.message.user.name;
        robot.send({room: general}, "Welcome " + name + "!");

        // Welcome new user personally
        WELCOME_MESSAGES.forEach((message, i) => setTimeout(() => {
            robot.send({room: res.message.user.id}, message);
        }, i * MESSAGE_PAUSE));

        // Get member count to see if we've hit a member milestone
        getNumMembers(robot, announcements, 0).then(memberCount => {
            // If we're not at a member milestone, don't bother celebrating!
            if (memberCount % MEMBER_MILESTONE != 0) {
                return;
            }

            res.send(":tada: " + memberCount + " members! :tada:");
        }).catch(err => console.log(err));
    });
};
