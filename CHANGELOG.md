# Changelog

## [2.23.2](https://github.com/huishouden/portal/compare/v2.23.1...v2.23.2) (2026-10-05)

### Bug Fixes

* Rebuild against the re-tagged kit ([30a69fa](https://github.com/huishouden/portal/commit/30a69fa65fddfce3554ec8e2211b666d1f7607b0))

## [2.23.1](https://github.com/huishouden/portal/compare/v2.23.0...v2.23.1) (2026-10-05)

### Performance

* the hub follows a week of the agenda, all of it only on Calendar ([f52f60a](https://github.com/huishouden/portal/commit/f52f60a466f78ae38036e33c9277e588e1b6f9db))

## 2.23.0 (2026-10-05)

### Features

* **calendar:** My calendar's Health details hint says Health items read "Medicine for Ana" or "Appointment for Ana" without details, as Health's new visits do (pwa-kit 0.101.0).

## [2.22.0](https://github.com/huishouden/portal/compare/v2.21.0...v2.22.0) (2026-10-05)

### Features

* hashed build files (`assets/*`) load from the suite's asset CDN (Cloudflare Worker `huishouden-assets`, pwa-kit 0.100.0); if the CDN fails the page falls back once to the site's own copy; `HH_ASSET_CDN=off` rolls the suite back ([012361c](https://github.com/huishouden/portal/commit/012361cc3e4871b327e489f466cc3438eec09c9a))

## [2.21.0](https://github.com/huishouden/portal/compare/v2.20.1...v2.21.0) (2026-10-05)

### Features

* /connect signs in the hh command line on this computer ([ef60b48](https://github.com/huishouden/portal/commit/ef60b48c29b1e80d17bcafc5543741b8a8f7400e))

### Bug Fixes

* **connect:** review findings; pwa-kit 0.95.0 ([65b791f](https://github.com/huishouden/portal/commit/65b791f0a7100464ce59a7cf700df7cca7b44dd1))

## [2.20.1](https://github.com/huishouden/portal/compare/v2.20.0...v2.20.1) (2026-10-05)

### Bug Fixes

* **dark:** app tiles and household initials keep an edge in dark; drop the nightly staging sweep ([8aff732](https://github.com/huishouden/portal/commit/8aff7321925cccd75b766a2f8ff1a126899c0074))

## 2.20.0 (2026-10-05)

### Features

* Bills' logo in the Apps grid is a receipt (kit 0.92.0), so it no longer matches Spending's card.

## [2.19.0](https://github.com/huishouden/portal/compare/v2.18.0...v2.19.0) (2026-10-05)

### Features

* **apps:** on phones, the apps are a home-screen grid and the household folds into rows (#105) ([8d9f982](https://github.com/huishouden/portal/commit/8d9f98294cce903a18ad32b3e19c312556030f9a))

### Other

* the suite's address from the kit (SUITE_ORIGIN) (#88) ([a0b1a69](https://github.com/huishouden/portal/commit/a0b1a69ae40b5360448029b5b72c4d9a895f60fe))

## [2.18.0](https://github.com/huishouden/portal/compare/v2.17.0...v2.18.0) (2026-10-05)


### Features

* **contacts:** contacts saved before positions get one in the background (kit 0.88.0) ([#102](https://github.com/huishouden/portal/issues/102)) ([f56f2c7](https://github.com/huishouden/portal/commit/f56f2c79d6ae123d9ff0e643a872d90cb7556d9d))


### Bug Fixes

* **privacy:** say New Relic keeps an approximate location, for 8 days ([#89](https://github.com/huishouden/portal/issues/89)) ([8dad56e](https://github.com/huishouden/portal/commit/8dad56e280eaf4470af888e8de5427d55ecc4c00))

## [2.17.0](https://github.com/huishouden/portal/compare/v2.16.2...v2.17.0) (2026-10-05)


### Features

* **calendar:** Continue in this tab, when Google's window is blocked or out of sight ([#98](https://github.com/huishouden/portal/issues/98)) ([42a6939](https://github.com/huishouden/portal/commit/42a6939894f18a833c98ea14fb40fc58cd92511e))

## [2.16.2](https://github.com/huishouden/portal/compare/v2.16.1...v2.16.2) (2026-10-05)


### Bug Fixes

* **today, todo:** done and not done look different, from the kit's completion pattern ([#99](https://github.com/huishouden/portal/issues/99)) ([5beeef4](https://github.com/huishouden/portal/commit/5beeef4339ec174f2bdef2f0c734ef74d45bcd0e))

## [2.16.1](https://github.com/huishouden/portal/compare/v2.16.0...v2.16.1) (2026-10-05)


### Bug Fixes

* **household:** /apps#household brings the Household panel into view, for apps that link to set the home ([#96](https://github.com/huishouden/portal/issues/96)) ([5a803f8](https://github.com/huishouden/portal/commit/5a803f84211be24a6a601803a96e72925d9d6470))

## [2.16.0](https://github.com/huishouden/portal/compare/v2.15.4...v2.16.0) (2026-10-04)


### Features

* **household:** a Home section for the household's address, by search or this device's location (kit 0.84.0) ([#94](https://github.com/huishouden/portal/issues/94)) ([759497d](https://github.com/huishouden/portal/commit/759497d09cd21e5abd5e1530bbdc4cbcfae64ff3))

## [2.15.4](https://github.com/huishouden/portal/compare/v2.15.3...v2.15.4) (2026-10-04)


### Bug Fixes

* **calendar:** Connect Google Calendar never fails silently; a way back to Google's window ([#92](https://github.com/huishouden/portal/issues/92)) ([2a58cba](https://github.com/huishouden/portal/commit/2a58cba0aac7b846bcfd2e8e8702a8f3b5d5a943))

## [2.15.3](https://github.com/huishouden/portal/compare/v2.15.2...v2.15.3) (2026-10-04)


### Bug Fixes

* **calendar:** say when Huishouden has used today's allowance, not "couldn't reach" ([#85](https://github.com/huishouden/portal/issues/85)) ([46ef1b1](https://github.com/huishouden/portal/commit/46ef1b13958517036c235caddcfac301c4f82cca))
* kit v0.71.2 to 0.82.1, contacts' pay details for admins and members only ([#91](https://github.com/huishouden/portal/issues/91)) ([9b238a6](https://github.com/huishouden/portal/commit/9b238a6de02ef8e527bffb32d52ee06d5175ee3d))

## [2.15.2](https://github.com/huishouden/portal/compare/v2.15.1...v2.15.2) (2026-10-04)


### Bug Fixes

* **monitoring:** kit v0.71.2, page views reported before the geography rules ([#83](https://github.com/huishouden/portal/issues/83)) ([40349cf](https://github.com/huishouden/portal/commit/40349cf709afaff084ad009fc01dd1143f0c7e0d))

## [2.15.1](https://github.com/huishouden/portal/compare/v2.15.0...v2.15.1) (2026-10-04)


### Bug Fixes

* **monitoring:** kit v0.71.1 (pipeline cloud rules, page views per app); publish settings after a late failure ([#81](https://github.com/huishouden/portal/issues/81)) ([f57694e](https://github.com/huishouden/portal/commit/f57694e93f44e88878dd9c77914fcb003342c4aa))

## [2.15.0](https://github.com/huishouden/portal/compare/v2.14.0...v2.15.0) (2026-10-04)


### Features

* provision New Relic from CI (monitoring workflow); kit v0.69.0 ([#78](https://github.com/huishouden/portal/issues/78)) ([d34c822](https://github.com/huishouden/portal/commit/d34c82230c99b7e9f6a5f2f8d706695ff4f12818))

## [2.14.0](https://github.com/huishouden/portal/compare/v2.13.0...v2.14.0) (2026-10-04)


### Features

* In your own calendar: a calendar link for any app, Google Calendar both ways, changes with Undo ([#76](https://github.com/huishouden/portal/issues/76)) ([88a21f9](https://github.com/huishouden/portal/commit/88a21f9f61f7770441b0f93472f14d02b235d14d))
* use Huishouden from your AI assistant (/assistant, /connect) ([#74](https://github.com/huishouden/portal/issues/74)) ([4ab8cd4](https://github.com/huishouden/portal/commit/4ab8cd4999f1e8ab19ea4e30dc0d33f6dedbd342))

## [2.13.0](https://github.com/huishouden/portal/compare/v2.12.1...v2.13.0) (2026-10-04)


### Features

* **apps:** Home's Landlord contact role, in Spanish and Dutch ([#72](https://github.com/huishouden/portal/issues/72)) ([b5970f0](https://github.com/huishouden/portal/commit/b5970f0f3ebad8d21db7cf47efa663870c654f00))

## [2.12.1](https://github.com/huishouden/portal/compare/v2.12.0...v2.12.1) (2026-10-04)


### Bug Fixes

* the to-do toast's past tense for to-dos written in Spanish or Dutch ([#70](https://github.com/huishouden/portal/issues/70)) ([14ec484](https://github.com/huishouden/portal/commit/14ec484909fc2caa4c0ae0dfa4e4295a29932669))

## [2.12.0](https://github.com/huishouden/portal/compare/v2.11.0...v2.12.0) (2026-10-04)


### Features

* the hub in Spanish and Dutch ([#68](https://github.com/huishouden/portal/issues/68)) ([4f8b000](https://github.com/huishouden/portal/commit/4f8b000399b65242b8ad3cd395c4927451dce9c8))

## [2.11.0](https://github.com/huishouden/portal/compare/v2.10.0...v2.11.0) (2026-10-04)


### Features

* dark mode that follows the suite's theme ([#66](https://github.com/huishouden/portal/issues/66)) ([f77a583](https://github.com/huishouden/portal/commit/f77a5830fa578f691e9652d84e3be885f46ff83f))

## [2.10.0](https://github.com/huishouden/portal/compare/v2.9.1...v2.10.0) (2026-10-03)


### Features

* Huishouden Health tile; Today, Calendar and To-do show items for named people (kit 0.56.0) ([#64](https://github.com/huishouden/portal/issues/64)) ([d968e9c](https://github.com/huishouden/portal/commit/d968e9cd80a4faa0f496d134879ac1b5c6bef389))

## [2.9.1](https://github.com/huishouden/portal/compare/v2.9.0...v2.9.1) (2026-10-03)


### Bug Fixes

* **todos:** Done on a set-dates job resolves its next due date at the tap (kit v0.55.0) ([#62](https://github.com/huishouden/portal/issues/62)) ([e11b7e9](https://github.com/huishouden/portal/commit/e11b7e90d8b7422b3d244b3a716f00a71d5dec17))

## [2.9.0](https://github.com/huishouden/portal/compare/v2.8.0...v2.9.0) (2026-10-03)


### Features

* To-do tab, every app's open things in one list (kit 0.53.0) ([#60](https://github.com/huishouden/portal/issues/60)) ([53fb450](https://github.com/huishouden/portal/commit/53fb45008e0aea3da7f3269f418e187471cdf4f3))

## [2.8.0](https://github.com/huishouden/portal/compare/v2.7.1...v2.8.0) (2026-10-03)


### Features

* Huishouden Groceries tile; Tasks is to-dos and chores ([#56](https://github.com/huishouden/portal/issues/56)) ([e678675](https://github.com/huishouden/portal/commit/e678675d418011d6469bb80861e99b8fc556d2de))
* sections in a bottom bar on phones (kit 0.52.0) ([#58](https://github.com/huishouden/portal/issues/58)) ([a906b9a](https://github.com/huishouden/portal/commit/a906b9aa2de56deebd432e82f2011160c19d895d))

## [2.7.1](https://github.com/huishouden/portal/compare/v2.7.0...v2.7.1) (2026-10-03)


### Bug Fixes

* dialogs keep focus where it was tapped on phones (pwa-kit 0.51.0) ([#54](https://github.com/huishouden/portal/issues/54)) ([8fafd72](https://github.com/huishouden/portal/commit/8fafd72bc4bd09443bb4b7d7c8a72bca05866ce8))

## [2.7.0](https://github.com/huishouden/portal/compare/v2.6.0...v2.7.0) (2026-10-03)


### Features

* tiles open moved apps at their path; their old addresses redirect (pwa-kit 0.49.0) ([#52](https://github.com/huishouden/portal/issues/52)) ([895c16e](https://github.com/huishouden/portal/commit/895c16eab13d6c8e176a533c3831a1c764e1abb8))


### Bug Fixes

* pwa-kit 0.48.0 (the site's /&lt;app&gt; redirect no longer loops) ([#50](https://github.com/huishouden/portal/issues/50)) ([4219be0](https://github.com/huishouden/portal/commit/4219be0a99206090c22afd513542021ea8dfec99))

## [2.6.0](https://github.com/huishouden/portal/compare/v2.5.0...v2.6.0) (2026-10-03)


### Features

* serve the suite from one site; the portal assembles and reconciles it (pwa-kit 0.47.0) ([#46](https://github.com/huishouden/portal/issues/46)) ([a86d5ef](https://github.com/huishouden/portal/commit/a86d5ef9071505fcb9d39aab1df06080dce31c17))

## [2.5.0](https://github.com/huishouden/portal/compare/v2.4.0...v2.5.0) (2026-10-03)


### Features

* **contacts:** add a contact from your own contacts; contact cards in the Share menu ([#47](https://github.com/huishouden/portal/issues/47)) ([56bc75c](https://github.com/huishouden/portal/commit/56bc75c2cfec18d1aa71e70b55dd56f8e55c5e11))

## [2.4.0](https://github.com/huishouden/portal/compare/v2.3.1...v2.4.0) (2026-10-02)


### Features

* **security:** security headers on app pages, none on Firebase /__/ sign-in paths ([#43](https://github.com/huishouden/portal/issues/43)) ([79bb7d0](https://github.com/huishouden/portal/commit/79bb7d0f3cadf03b7f0d1712ce3bb3731397f428))

## [2.3.1](https://github.com/huishouden/portal/compare/v2.3.0...v2.3.1) (2026-10-02)


### Bug Fixes

* Today drops a missed put-the-bins-out task (pwa-kit 0.41.0) ([#41](https://github.com/huishouden/portal/issues/41)) ([06f80d3](https://github.com/huishouden/portal/commit/06f80d36cc29c4960457d5efcb73deb5f3c96677))

## [2.3.0](https://github.com/huishouden/portal/compare/v2.2.1...v2.3.0) (2026-10-02)


### Features

* error, speed and anonymous usage reports (pwa-kit observability) ([#37](https://github.com/huishouden/portal/issues/37)) ([c4e21d3](https://github.com/huishouden/portal/commit/c4e21d33f3c1c67d2bf3240b282be2dba3f6a087))
* **roles:** roles in the household panel; helpers see no money, settings or private contacts ([#40](https://github.com/huishouden/portal/issues/40)) ([965f687](https://github.com/huishouden/portal/commit/965f687212d79ec2c6f3b947f8c7681d65dae5a0))

## [2.2.1](https://github.com/huishouden/portal/compare/v2.2.0...v2.2.1) (2026-10-02)


### Bug Fixes

* an entry saved just before the app closes is no longer lost ([#36](https://github.com/huishouden/portal/issues/36)) ([15d4d9e](https://github.com/huishouden/portal/commit/15d4d9e5b5b89f7f837347eaedf6d4f1d2291d3d))

## [2.2.0](https://github.com/huishouden/portal/compare/v2.1.0...v2.2.0) (2026-10-02)


### Features

* Today shows what's done, kind icons, spice chips, no signed-out flash on reload ([#34](https://github.com/huishouden/portal/issues/34)) ([e6592da](https://github.com/huishouden/portal/commit/e6592da40d7022c8c74ce33403694c8a42dbc3d3))

## [2.1.0](https://github.com/huishouden/portal/compare/v2.0.0...v2.1.0) (2026-10-02)


### Features

* the household's food preferences in the household panel ([#29](https://github.com/huishouden/portal/issues/29)) ([af5d753](https://github.com/huishouden/portal/commit/af5d75342f845ce1c54738c66b095868e89be051))

## [2.0.0](https://github.com/huishouden/portal/compare/v1.6.0...v2.0.0) (2026-10-02)


### ⚠ BREAKING CHANGES

* the household hub on React: Today, Calendar, Contacts and Apps ([#27](https://github.com/huishouden/portal/issues/27))

### Features

* the household hub on React: Today, Calendar, Contacts and Apps ([#27](https://github.com/huishouden/portal/issues/27)) ([4fafb30](https://github.com/huishouden/portal/commit/4fafb30fadf8b38923893c228371dd6213a67bf5))

## [1.6.0](https://github.com/huishouden/portal/compare/v1.5.1...v1.6.0) (2026-10-02)


### Features

* households order and hide their app tiles; everyday apps first by default ([#25](https://github.com/huishouden/portal/issues/25)) ([ceaf0c3](https://github.com/huishouden/portal/commit/ceaf0c322ad4a94886e551a20ba1316ee2c61621))

## [1.5.1](https://github.com/huishouden/portal/compare/v1.5.0...v1.5.1) (2026-10-02)


### Bug Fixes

* Google API tokens from Google Identity Services, not Firebase sign-in (kit v0.23.0) ([#22](https://github.com/huishouden/portal/issues/22)) ([f69f6cc](https://github.com/huishouden/portal/commit/f69f6cc85007a1d8e364aa4cb425920f9630f4e1))

## [1.5.0](https://github.com/huishouden/portal/compare/v1.4.0...v1.5.0) (2026-10-02)


### Features

* start a household, a first-run introduction, and renaming the household ([#17](https://github.com/huishouden/portal/issues/17)) ([746a197](https://github.com/huishouden/portal/commit/746a19744256bce149ae2a55587a92f87a76bfc1))

## [1.4.0](https://github.com/huishouden/portal/compare/v1.3.0...v1.4.0) (2026-10-02)


### Features

* the Dutch greeting explains itself — hover or tap for an English sound-alike, meaning and audio ([#14](https://github.com/huishouden/portal/issues/14)) ([294e7af](https://github.com/huishouden/portal/commit/294e7af6eaae0b355b5585c6d0d6bede6f2d77ca))

## [1.3.0](https://github.com/huishouden/portal/compare/v1.2.0...v1.3.0) (2026-10-02)


### Features

* the kit's Huishouden app bar replaces the header and account chip (kit v0.17.0) ([#11](https://github.com/huishouden/portal/issues/11)) ([83b4fe3](https://github.com/huishouden/portal/commit/83b4fe318739a13dab89f6bc7a93fb0b1f19120e))

## [1.2.0](https://github.com/huishouden/portal/compare/v1.1.0...v1.2.0) (2026-10-02)


### Features

* household members show their name and photo; invites can be emailed from your Gmail ([#7](https://github.com/huishouden/portal/issues/7)) ([7af1d0b](https://github.com/huishouden/portal/commit/7af1d0b30859c642c11f04aa8f0c5b164a7afc05))

## [1.1.0](https://github.com/huishouden/portal/compare/v1.0.0...v1.1.0) (2026-10-02)


### Features

* one app registry (apps.json) for portal tiles and bootstrap; Baby appears in the portal ([#5](https://github.com/huishouden/portal/issues/5)) ([c7c9d3c](https://github.com/huishouden/portal/commit/c7c9d3c58e836149bdb91367c519bdeba06f28d7))

## 1.0.0 (2026-10-02)


### Features

* household panel — sign in, see members (signed in / invited), invite and remove ([9e5c5a7](https://github.com/piekstra/huishouden/commit/9e5c5a7eefbdc947a51a516c86e75eefb92f102d))
* Huishouden design language, family logo, plain app names, version in the account menu ([#1](https://github.com/piekstra/huishouden/issues/1)) ([ae8f8f4](https://github.com/piekstra/huishouden/commit/ae8f8f4bd057961c8b49b184785b59d7815a52d5))
* Huishouden portal PWA linking the household apps ([f7e8fb2](https://github.com/piekstra/huishouden/commit/f7e8fb22eddd56e66ad4d7861022edc5edac4151))
* profile photo in the header shows who is signed in; tap for account and sign out ([9ca7986](https://github.com/piekstra/huishouden/commit/9ca7986425e0b953d83dea4212c293326ffbb73c))
* Tasks & Groceries tile is live ([85934b1](https://github.com/piekstra/huishouden/commit/85934b1691662c1057e4cafc6750c002b6d89132))


### Bug Fixes

* **pwa:** service worker leaves Firebase /__/ paths to the network ([682b0ae](https://github.com/piekstra/huishouden/commit/682b0ae70667257a3f2a2c3fa1a0a65fd85badd5))
