# Changelog

## [1.5.1](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/compare/v1.5.0...v1.5.1) (2024-10-10)


### Bug Fixes

* add log message for closed pull requests ([d640681](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d640681cbcbbf5961e61c4f41eec8b82d963444d))
* downgrade ethers to 5.7.2 and update web3 helper ([c5e8e3c](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c5e8e3c0877bd21e80d745bdae557d28c74bd7f4))
* remove redundant console log in run.ts ([7851b75](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/7851b7524822c42b62e1c67dca4a00bcbe9d7f4f))
* upgrade permit generation package ([5300022](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/5300022f2b45d0d1b5c48b2d0db46014a5643bf5))

## [1.5.0](https://github.com/ubiquity-os-marketplace/conversation-rewards/compare/v1.4.0...v1.5.0) (2024-09-30)

### Features

- add private key formats ([43ffc4d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/43ffc4d11692c9f4f6129288c7c0513698c60b34))
- added log level ([f41393a](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/f41393ac5651a16b9af79a406997fcdcfdbf1d03))
- changed word count and introduced elementCount ([6911a5d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/6911a5d0586cfbb415e3653d3ddaf15d5dc311ea))
- compressing html output ([741ee20](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/741ee20362c00963d8444d7cb8c0c95857420d9d))
- content is stripped if it is too large for a comment ([f2ca2bb](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/f2ca2bb27b2a6be04304d9b6e02e5b1b9f18a286))
- skip minimized comments ([0a7576d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/0a7576d65ea6845f771c9b2c26c39481743ee32c))
- support individual repos ([0d34345](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/0d343459bdd42f23c22077c8fc9d2ddce46fa2ca))

### Bug Fixes

- apply fixes to broken merge ([bbb22e6](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/bbb22e641255085bdb97c01cee4da00455239b57))
- edited the mock results to match new calculation module ([a0d007c](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/a0d007cde2deb51385d72984e88f945deea42d41))
- fix github comment and reward split tests ([4e24f40](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/4e24f40430473211ffed8aab72a5998f6df48660))
- fix github comment and reward split tests ([3cee864](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/3cee86421ae55c74736380cc98beba018c75c4ff))
- fixed decimal issues with evaluation ([1e30cd2](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/1e30cd22a30ce460859cfda45eb63fc549776ea8))
- fixed issues with permit generation and mock results ([aa3affa](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/aa3affa772945618a51caffbc7705489b9233204))
- html content is stripped from metadata ([a595751](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/a59575127e688503335e9d81d5790029b64bdf74))
- include forgotten reward-split calculation changes ([b171bb6](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/b171bb68383b8d5e20dc38cd86fd052fb0334a48))
- no message is posted on skip ([512519d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/512519db690d81a8eeb6178e40f61bccec6e9b14))
- refactored extra calculation and fixed mock results ([834910e](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/834910e777ab751e9bef4255f8b418ab31c8cb5b))
- relevance is only applied to content ([8c4fe1b](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/8c4fe1b57e154581186d97148725d6c4e04ba7b1))
- removed regex from configuration ([19e70a4](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/19e70a4e946e8b6560a9265de95198c6c2d56b46))
- resolve conflicts ([434d28a](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/434d28a58f9aa815f5df0481e8d654190ad08176))
- test permit related mock test result fixes ([0b6f245](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/0b6f24537696ea3d621a6b27e12e27d72136830b))
- typo ([cd740ab](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/cd740ab0ec3c7cbe33c50c550e082631afb0704e))
- use camel casing for property name ([2da6b86](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/2da6b868c9700b68e5bbedfb64683e42b384755c))
- use issue.node_id for permit nonces ([1d2ad4d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/1d2ad4d04c43184de6559aabb36be7f506287a79))

## [1.2.0](https://github.com/ubiquibot/conversation-rewards/compare/v1.1.0...v1.2.0) (2024-07-10)

### Features

- reward is now split if there are multiple assignees ([b556238](https://github.com/ubiquity-os/conversation-rewards/commit/b55623812633bc48760e07bbbd7a1c8f7509121d))

### Bug Fixes

- assignees are added to the reward even without commenting ([170cdcc](https://github.com/ubiquity-os/conversation-rewards/commit/170cdcc694cf4499eb8210beff1a58885c99c5a4))
- users with no comment now can see their issue task on multiple assignees ([615d221](https://github.com/ubiquity-os/conversation-rewards/commit/615d221bc1d0a8129f58e2c0ff5c06339d177792))

## [1.1.0](https://github.com/ubiquity-os/conversation-rewards/compare/v1.0.0...v1.1.0) (2024-07-07)

### Features

- add erc20RewardToken config param ([2b53e68](https://github.com/ubiquity-os/conversation-rewards/commit/2b53e6875178d8f4ead54a620dc13e0e5f8c2322))
- pass token address on permit generation ([6fd15dd](https://github.com/ubiquity-os/conversation-rewards/commit/6fd15ddcdf71062f905a14ddf4c4dd5fe8051e38))
- set default erc20 reward param to WXDAI ([f7ad975](https://github.com/ubiquity-os/conversation-rewards/commit/f7ad97538c7a5da1dfee37f309be4a2885847574))

### Bug Fixes

- resolve conflicts ([f8159e1](https://github.com/ubiquity-os/conversation-rewards/commit/f8159e16d7988ba7346208fba8d18b25115fe4bb))
- updated test suite to match the new schema, fixed the async test to not run after tear down ([ca6e472](https://github.com/ubiquity-os/conversation-rewards/commit/ca6e472511cbecad9a7b3ce7ba137e9c6b3ce3ff))

## 1.0.0 (2024-06-11)

### Features

- cli argument to pass the issue URL to the program ([d4e9116](https://github.com/ubiquity-os/conversation-rewards/commit/d4e91169ffd22b0f3bd0c26adc5829391c37437f))
- collect all user events ([147ba83](https://github.com/ubiquity-os/conversation-rewards/commit/147ba83525c8626ebfccae97c30f368e087f4029))
- command line parsing arguments ([af93229](https://github.com/ubiquity-os/conversation-rewards/commit/af932291d1b17f535b2cc5e5c02ce2ad4cfe7028))
- configuration parser ([0e6f3d1](https://github.com/ubiquity-os/conversation-rewards/commit/0e6f3d192713bf5803b82aa5c80f73d8fab0989a))
- formatting is evaluated and influences the final score ([45d2831](https://github.com/ubiquity-os/conversation-rewards/commit/45d2831ffb0337a68d4d4280f6a550c12c712d68))
- **get-activity:** properly fetches everything according to test ([6e067f7](https://github.com/ubiquity-os/conversation-rewards/commit/6e067f71b69f58f1f1391ccce522c67fafd8fb94))
- github app login ([f4f4896](https://github.com/ubiquity-os/conversation-rewards/commit/f4f4896b8611acd53f61685a6774665b5dfb8928))
- github app login ([b2efc68](https://github.com/ubiquity-os/conversation-rewards/commit/b2efc68d996d9202ff4bd6a3385e9922e8eda846))
- github app login ([df34aa7](https://github.com/ubiquity-os/conversation-rewards/commit/df34aa71a1c36563f34a14ea1fb4220642332012))
- github app login ([8add964](https://github.com/ubiquity-os/conversation-rewards/commit/8add9648f2717d71b6fb32b806fb97fd7cad800c))
- github app login ([ad16266](https://github.com/ubiquity-os/conversation-rewards/commit/ad1626672a42d5e2ba3f6404cb51db6d233e0c9c))
- github app login ([013519d](https://github.com/ubiquity-os/conversation-rewards/commit/013519d80fad987f7ca7bfb2774f7d5ed00d9468))
- github app login ([39fa39d](https://github.com/ubiquity-os/conversation-rewards/commit/39fa39d58f38e984e3b3120d09338becef753e36))
- link pull request from issue (not other way around) ([e6aa979](https://github.com/ubiquity-os/conversation-rewards/commit/e6aa97973e7b8bb64551bd060ab6e2e005b6d4d3))
- moved tsx to production dependencies ([423f49e](https://github.com/ubiquity-os/conversation-rewards/commit/423f49e2dfaff1b8ca4603100cd89aa41b0b6e52))
- pass in token from kernel to authenticate octokit client ([1f4ba00](https://github.com/ubiquity-os/conversation-rewards/commit/1f4ba009bd81b3cbea79e8cde1735407d0504037))
- permit generation module ([925243f](https://github.com/ubiquity-os/conversation-rewards/commit/925243f8ac5cc847b4b63ac76195d0d3de3c9fed))
- permit generation module ([50b396b](https://github.com/ubiquity-os/conversation-rewards/commit/50b396b26e1bec433f193481004a7db6505f5ba5))
- read inputs from GitHub inputs instead of CLI ([30ac759](https://github.com/ubiquity-os/conversation-rewards/commit/30ac759a2e81633304f91ff127a7d6848af420d2))
- saving permit to database ([aecd4e1](https://github.com/ubiquity-os/conversation-rewards/commit/aecd4e127e9341ae18c18b14bf7c1c5dc8f98a6b))
- untested class to get all information ([f5104e1](https://github.com/ubiquity-os/conversation-rewards/commit/f5104e14034cf2b6174bff1c6d3669aa177e438c))
- untested class to get all information ([a86c62f](https://github.com/ubiquity-os/conversation-rewards/commit/a86c62f67c48a129dcb904d6fd69663c9e847f0d))
- updated jest test workflow ([a69f8d9](https://github.com/ubiquity-os/conversation-rewards/commit/a69f8d9c82a8316b90f4c9f14b177185ebefcb25))
- updated jest test workflow ([834f821](https://github.com/ubiquity-os/conversation-rewards/commit/834f821b42079c30d8e194749e6538e2d5a17ceb))

### Bug Fixes

- all tests pass ([db1868e](https://github.com/ubiquity-os/conversation-rewards/commit/db1868e60fe96ea9f8a30a347d40e1cac7c9e067))
- **ci:** auth ([e897fdb](https://github.com/ubiquity-os/conversation-rewards/commit/e897fdb4c0bcaeecbd6b6445a85a58d26b613338))
- cspell ([890a4a4](https://github.com/ubiquity-os/conversation-rewards/commit/890a4a4c250d40d99fb6e127664c02544eef0826))
- cspell ignore words ([1160614](https://github.com/ubiquity-os/conversation-rewards/commit/11606142d26cbd57c7c33f9e08d0e0a6bab689d2))
- fixed path for evm values ([2f3c2ee](https://github.com/ubiquity-os/conversation-rewards/commit/2f3c2ee229400031e1fd95324d91677eda84925e))
- more characters are escaped (backtick, ampersand) to avoid display issues ([550869c](https://github.com/ubiquity-os/conversation-rewards/commit/550869c13e48e4bb2865acb629bed66b6a3ab1e6))
- permit generation is skipped if price label is missing (configurable) ([d59cb0a](https://github.com/ubiquity-os/conversation-rewards/commit/d59cb0a93c50770ec946514627ca34406e3da2e0))
- remove build action and changed trigger for Jest testing ([146580e](https://github.com/ubiquity-os/conversation-rewards/commit/146580efc68b6d8ccaf56ba3873bc2dead03bd68))
- skip on issue close not completed status ([2c15e7c](https://github.com/ubiquity-os/conversation-rewards/commit/2c15e7c44ea878221cce0afba4b93ffa3f4da067))
- **test:** resolve promises ([9d57104](https://github.com/ubiquity-os/conversation-rewards/commit/9d571040cc8219c23a506ff8809273b991058f49))
- **test:** resolve promises ([1d62274](https://github.com/ubiquity-os/conversation-rewards/commit/1d62274efb1cafea37356cf7d59069a4413bc436))
- types ([c4ad907](https://github.com/ubiquity-os/conversation-rewards/commit/c4ad90732a3ba25098866ecb09103d8b780f05c8))
