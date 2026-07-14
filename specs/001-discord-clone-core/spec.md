# Feature Specification: Discord Clone Core

**Feature Branch**: `001-discord-clone-core`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Build a real-time chat and video calling application modeled on Discord — auth, servers, channels, real-time text messaging with edit/delete/typing indicators, direct messages, and voice/video calls (2-4 participants)."

## Clarifications

### Session 2026-07-14

- Q: What happens when a call participant's connection drops mid-call — removed immediately, kept until they explicitly leave, or given a grace period? → A: Short grace period (~10s) to allow reconnection before removing them from the call view.
- Q: What happens when a server's owner leaves their own server (without deleting their account) — deleted, transfer required, or left ownerless? → A: Owner leaving deletes the server entirely, same as account deletion — no ownership-transfer mechanism.
- Q: What is the target scale for v1 (concurrent users, number of servers)? → A: Small scale — dozens of concurrent users total, a handful of servers, up to 4 participants per call.
- Q: What content constraints apply to a text message (empty messages, length limit)? → A: Reject empty/whitespace-only messages; cap length at ~4000 characters.
- Q: Confirm — can a removed member rejoin a server via a still-valid invite link, same as any new member? → A: Yes, confirmed as-is (matches the existing Assumptions entry); no ban/blocklist mechanism in v1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chat in a Server (Priority: P1)

A new user signs up, creates a server (or joins one via an invite link), and
exchanges text messages with other members in the server's default "general"
channel. Messages sent by any member appear for everyone else instantly,
without anyone refreshing the page.

**Why this priority**: This is the minimum loop that makes the app a "chat
app" at all — account, a shared space, and live text messaging. Nothing else
is useful without it.

**Independent Test**: Two accounts can be created, one creates a server and
shares the invite link, the other joins, and both can exchange messages in
`#general` and see each other's messages appear live.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they sign up with a display
   name and credentials, **Then** they land in the app as an authenticated
   user with a default avatar and an "online" status visible to others.
2. **Given** a logged-in user, **When** they create a server and give it a
   name, **Then** a new server is created with them as owner, a `#general`
   text channel already exists, and they are its only member.
3. **Given** a server owner, **When** they generate an invite link and share
   it, **Then** another logged-in user who opens that link joins the server
   and appears in its member sidebar as online.
4. **Given** two members in the same channel, **When** one sends a text
   message, **Then** it appears in the other member's channel view within
   seconds, without a manual refresh, showing author name, avatar, and
   timestamp.
5. **Given** a member viewing a channel, **When** another member is typing,
   **Then** a typing indicator appears and disappears appropriately.
6. **Given** a message author, **When** they edit or delete their own
   message, **Then** the change is reflected for all members in real time,
   and edited messages are visibly marked as edited.
7. **Given** a channel with more history than fits on screen, **When** a
   member scrolls up, **Then** older messages load incrementally
   (newest-first, infinite scroll).
8. **Given** a logged-in user, **When** they update their display name or
   avatar image in their profile settings, **Then** the change is saved and
   the new name/avatar appears immediately on their future messages and in
   member sidebars for other users.
9. **Given** a member composing a message, **When** they try to send an
   empty or whitespace-only message, or a message longer than ~4000
   characters, **Then** the send is rejected with feedback explaining why.

---

### User Story 2 - Manage Server & Channels (Priority: P2)

A server owner organizes their community: renaming the server, creating
additional text and voice channels, renaming or deleting channels, and
removing members who should no longer have access.

**Why this priority**: Once a server exists, it needs structure beyond a
single channel to be a usable community space; this is naturally layered on
top of User Story 1 and is owner-only, so it doesn't block basic chat.

**Independent Test**: As the owner of an existing server, create a new text
channel and a voice channel, rename the server, rename a channel, delete a
channel, and remove a member — verify each change is visible to all
remaining members immediately.

**Acceptance Scenarios**:

1. **Given** a server owner, **When** they create a new text or voice
   channel, **Then** it appears in the channel list for all members.
2. **Given** a server owner, **When** they rename the server or a channel,
   **Then** the new name is visible to all members immediately.
3. **Given** a server owner, **When** they delete a channel, **Then** the
   channel and all of its messages are removed for all members.
4. **Given** a server owner, **When** they remove a member from the server,
   **Then** that member immediately loses access to the server's channels
   and no longer appears in the member sidebar.
5. **Given** a non-owner member, **When** they attempt to rename, create, or
   delete a channel, or remove another member, **Then** the action is
   rejected.
6. **Given** a server owner, **When** they leave their own server, **Then**
   the server and all of its channels and messages are deleted for every
   remaining member.

---

### User Story 3 - Voice & Video Calls in a Channel (Priority: P3)

A member joins a voice channel and enters a live call with whoever else is
already connected to that channel, with working microphone/camera toggles
and visible speaking/mute indicators.

**Why this priority**: This is the second pillar of the product's value
(voice/video, not just text) but depends on servers/channels already
existing from User Story 1.

**Independent Test**: Two members join the same voice channel from separate
sessions and confirm each sees the other's video tile, can mute/unmute and
toggle camera, can see who's speaking, and see each other listed as
connected to that channel in the channel list.

**Acceptance Scenarios**:

1. **Given** a member viewing a voice channel with no active call, **When**
   they join it, **Then** a new call session starts and they see themselves
   as connected.
2. **Given** a voice channel with an active call, **When** another member
   joins, **Then** they enter the same live call and all participants see
   each other's video tiles (or an avatar placeholder if camera is off).
3. **Given** a participant in a call, **When** they toggle their microphone
   or camera, **Then** their state updates for all other participants
   immediately.
4. **Given** a participant speaking, **When** their microphone picks up
   audio, **Then** other participants see a visual "speaking" indicator on
   their tile; muted participants show a "muted" indicator instead.
5. **Given** a participant in a call, **When** they leave, **Then** they are
   removed from the call and from the channel's connected-members display
   for everyone else.
6. **Given** anyone viewing the channel list, **When** members are connected
   to a voice channel, **Then** those members are shown next to that
   channel.
7. **Given** a participant whose connection drops mid-call, **When** they
   do not reconnect within ~10 seconds, **Then** they are removed from the
   call and from the channel's connected-members display for everyone
   else; if they reconnect within that window, they remain shown as
   connected throughout.

---

### User Story 4 - Direct Messages (Priority: P4)

Any user starts a private 1-on-1 conversation with another member of a
server they share, exchanging real-time text messages the same way as in a
channel, and can start a 1-on-1 video call from that conversation.

**Why this priority**: DMs reuse the messaging (US1) and calling (US3)
capabilities in a new context; valuable but not required for the core
server experience to work.

**Independent Test**: Two users who share a server open a DM with each
other, exchange messages in real time with edit/delete support, and start a
1-on-1 video call from the DM.

**Acceptance Scenarios**:

1. **Given** two users who share at least one server, **When** one opens a
   DM with the other, **Then** a private conversation is created (or
   resumed if one already exists) visible only to the two of them.
2. **Given** an open DM, **When** either participant sends, edits, or
   deletes a message, **Then** the other participant sees the update in
   real time, matching channel messaging behavior.
3. **Given** an open DM, **When** either participant starts a video call,
   **Then** the other participant is invited into a 1-on-1 call with the
   same mic/camera/speaking controls as a voice channel call.
4. **Given** two users who do **not** share any server, **When** one tries to
   open a DM with the other, **Then** the action is not available.

---

### Edge Cases

- When a server owner leaves their own server, or deletes their account
  entirely, the server and all of its data (channels, messages) are
  deleted for all members — there is no ownership-transfer mechanism in
  v1.
- What happens when a member attempts to use an invite link for a server
  they were previously removed from — are they allowed to rejoin?
- What happens when a 5th member tries to join a voice channel that already
  has 4 connected participants?
- What happens when two members try to edit/delete the same message-related
  state concurrently (e.g., message deleted while another member is
  mid-edit-view)?
- When a member's connection drops mid-call, they are kept in the call's
  connected-members display for a short grace period (~10 seconds) to
  allow automatic reconnection; if they don't reconnect within that
  window, they are removed from the call for everyone else.
- What happens when the channel a user is actively viewing (or in a call
  in) is deleted by the owner while they're using it?
- What happens when someone opens an invite link for a server that has
  since been deleted?

## Requirements *(mandatory)*

### Functional Requirements

**Accounts & Presence**

- **FR-001**: System MUST allow a visitor to sign up with a display name and
  credentials, and to log in and out.
- **FR-002**: System MUST let each user set/update a display name and
  avatar image.
- **FR-003**: System MUST track and display each user's online/offline
  status to other users who share a server with them.

**Servers**

- **FR-004**: System MUST let a logged-in user create a server with a name
  and an optional image; the creator becomes the server's owner.
- **FR-005**: System MUST create a default `#general` text channel
  automatically when a server is created.
- **FR-006**: System MUST let a server owner generate an invite link that
  grants any logged-in user who opens it membership in that server.
- **FR-007**: System MUST display, for each server, a list of its members
  and each member's current online/offline status.
- **FR-008**: System MUST let a server owner rename the server.
- **FR-009**: System MUST let a server owner remove a member from the
  server; a removed member immediately loses access to the server's
  channels and content.
- **FR-010**: System MUST prevent non-owner members from renaming the
  server or removing members.
- **FR-010a**: When a server's owner leaves the server, System MUST
  delete the server and all of its channels and messages for every
  member; there is no ownership-transfer mechanism in v1.

**Channels**

- **FR-011**: System MUST let a server owner create additional text
  channels and voice channels within a server.
- **FR-012**: System MUST let all members of a server view the full list of
  its text and voice channels.
- **FR-013**: System MUST let a server owner rename any channel.
- **FR-014**: System MUST let a server owner delete a channel; deleting a
  channel MUST also delete all messages that belong to it.
- **FR-015**: System MUST prevent non-owner members from creating,
  renaming, or deleting channels.

**Messaging**

- **FR-016**: System MUST let any server member send a text message to a
  text channel they can view.
- **FR-016a**: System MUST reject empty or whitespace-only message
  content, and MUST cap message length at approximately 4000 characters;
  the same limits apply to direct messages and to message edits.
- **FR-017**: System MUST deliver new messages to all members currently
  viewing a channel in real time, without requiring a manual refresh.
- **FR-018**: Each message MUST display its author's name and avatar, a
  timestamp, and its text content.
- **FR-019**: System MUST let a message's author edit or delete their own
  message; System MUST NOT let any other member edit or delete it.
- **FR-020**: An edited message MUST be visibly marked as edited to all
  viewers.
- **FR-021**: System MUST load channel message history newest-first and
  support loading older messages incrementally (infinite scroll) as the
  member scrolls back.
- **FR-022**: System MUST show a typing indicator to other members of a
  channel while a member is actively composing a message, and MUST clear
  it when they stop or send.

**Direct Messages**

- **FR-023**: System MUST let a user open a private 1-on-1 conversation
  with any other user with whom they share at least one server.
- **FR-024**: System MUST NOT allow a direct-message conversation to be
  viewed by anyone other than its two participants.
- **FR-025**: Direct messages MUST support the same real-time delivery,
  author display, and edit/delete behavior as channel messages (FR-017
  through FR-021).

**Voice & Video Calls**

- **FR-026**: System MUST let a member join a voice channel, entering a
  live call with whichever other members are already connected to that
  channel.
- **FR-027**: System MUST support at least 2 and up to 4 simultaneous
  participants in a single voice/video call.
- **FR-028**: System MUST let each call participant independently toggle
  their own microphone and camera on/off.
- **FR-029**: System MUST show each participant a live video tile for
  every other participant with camera on, and a placeholder for
  participants with camera off.
- **FR-030**: System MUST visually indicate, per participant, whether they
  are currently speaking and whether they are muted.
- **FR-031**: System MUST let a participant leave a call at any time,
  removing them from the call and from that channel's connected-members
  display for everyone else.
- **FR-031a**: If a participant's connection drops without an explicit
  leave action, System MUST keep them in the call's connected-members
  display for a short grace period (~10 seconds) to allow automatic
  reconnection, then remove them for everyone else if they have not
  reconnected within that window.
- **FR-032**: System MUST show, in the channel list, which members are
  currently connected to each voice channel.
- **FR-033**: System MUST let a user start a 1-on-1 video call directly
  from a direct-message conversation, with the same controls as a voice
  channel call (FR-028 through FR-031).

### Key Entities

- **User**: An account holder. Attributes: display name, avatar, online/
  offline status, credentials (for authentication). Relationships: owns or
  is a member of zero or more Servers; participates in DirectMessage
  conversations; participates in Calls.
- **Server**: A named community, optionally with an image, with exactly one
  owner. Relationships: has one or more Channels (always including one
  default text channel); has one or more Members (Users); has an invite
  mechanism for new members.
- **Membership**: The relationship between a User and a Server, carrying
  the owner-vs-member distinction and online status visibility within that
  server's sidebar.
- **Channel**: A named space within a Server, of type text or voice.
  Relationships: belongs to exactly one Server; a text Channel contains
  Messages; a voice Channel has zero or one active Call and a set of
  currently-connected Users.
- **Message**: A piece of text content authored by a User inside a text
  Channel or a DirectMessage conversation. Attributes: content, author,
  timestamp, edited flag, created/updated state supporting edit and delete
  by its author only.
- **DirectMessage (conversation)**: A private 1-on-1 conversation between
  exactly two Users who share at least one Server. Contains Messages with
  the same behavior as channel messages.
- **Call**: A live voice/video session tied to a voice Channel or to a
  DirectMessage conversation. Attributes: current participants (up to 4),
  and per-participant microphone/camera/speaking state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from signup to sending their first message
  in a server in under 2 minutes.
- **SC-002**: A message sent by one member becomes visible to another
  member already viewing the same channel or DM in under 2 seconds under
  normal network conditions.
- **SC-003**: Presence (online/offline status) and typing indicators reflect
  a user's real state within 5 seconds of it changing, with no manual
  refresh required by any viewer.
- **SC-004**: 100% of message edit/delete actions performed by an author
  are reflected to all other viewers without any viewer needing to refresh.
- **SC-005**: A member can join an in-progress voice/video call in a
  channel with up to 4 participants and see/hear all other participants
  within 5 seconds of joining.
- **SC-006**: Server owners can complete each management action (rename
  server, create/rename/delete a channel, remove a member) in under 30
  seconds, with no step requiring external documentation.
- **SC-007**: Non-owner members are blocked from 100% of owner-only actions
  (server rename, channel create/rename/delete, member removal).
- **SC-008**: Users can scroll back through at least several hundred prior
  messages in a busy channel via infinite scroll without the interface
  becoming unresponsive.
- **SC-009**: The system remains responsive (meets SC-002, SC-003, SC-005)
  with at least a few dozen concurrent users spread across a handful of
  servers, matching v1's small-scale student-project target.

## Assumptions

- Authentication is standard credential-based (e.g., email/password-style
  sign-up and login); no specific third-party identity provider is
  mandated for v1.
- A server's invite link is reusable by multiple people and does not
  expire by default in v1 (no expiring/single-use invite requirement was
  specified).
- The default `#general` text channel is not specially protected from
  owner actions — it can be renamed or deleted by the owner the same as
  any other text channel, since the spec calls out owner control over
  channels without carving out an exception.
- If a server's owner leaves the server or deletes their account, the
  server and its data are removed entirely rather than left ownerless or
  transferred (no ownership-transfer mechanism was specified for v1,
  matching the "owner vs member" scope limit called out for v1; see
  Clarifications).
- A member removed from a server loses access immediately; rejoining
  requires a new use of a still-valid invite link, and re-admits them as a
  regular member (not automatically re-granted any prior state).
- Voice/video call capacity is a hard cap of 4 simultaneous participants
  per call; a 5th member attempting to join a full voice channel is
  informed the channel/call is full rather than joining.
- Out of scope per the feature description: message attachments/files,
  reactions, threads, roles/permissions beyond owner vs. member, screen
  sharing, mobile apps, and message search.
