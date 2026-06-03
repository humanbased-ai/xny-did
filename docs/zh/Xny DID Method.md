Overview
did:xny是一种针对 Web3 应用设计的去中心化身份标识（DID）方法，旨在为用户、数据资产和智能合约提供统一、可验证且可控的数字身份。
与传统 DID 不同，did:xny不使用链上地址来生成method uri，而是使用随机数的方式，这样可以保证did:xny和链无关，便于在多链上实现。
did:xny使用controller进行文档更新，同时规定所属did具有最高权限，使身份控制更安全、灵活。它支持链上身份验证、跨链交互以及凭证管理，为数据访问控制、资产管理和去中心化应用提供可信基础。
通过 did:xny，用户可以在保持隐私的前提下，安全地管理自己的数字身份，同时开发者和平台可以方便地实现权限委托、验证和使用追踪。
Identifier Syntax
identifier的格式为did:xny:<method-specific-id>
Operations
Register
任何用户可以进行did注册。
推荐: 为了防止某些用户大规模抢注did，需要进行一定限制，建议是让注册用户付出一定成本。
Resolve
链下的Resolver提供did的解析服务，返回json格式的did document
Update
只有controller中声明的did可以更新did document信息，包括添加和撤销controller，文档自己的did一定不能被撤销，所使用的验证方式必须在verificationMethods中声明。
对于数组属性，可以直接全量覆盖，也可以覆盖其中某个元素，但是数组元素就是最小可修改单位了。
Transfer
did:xny可以通过转移did来延长did的生命周期
Deactivate
did:xny支持did所有者注销did
Method-specific Identifier
<method-specific-id>采用随机算法进行生成，数据类型为uint128。
推荐: 可以使用UUID v4，只有122个有效位，但是可以增加可读性，符合UUID规范。在实现存储时，可以使用uint128进行存储，但是did resolver解析出来后转为UUID格式。
Method-specific DID Document Structure
Must-haves
- @context: DID Document上下文，为了兼容w3c did标准的JSON-LD而添加，数组
- id: DID identifier字符串
- owner: wallet address, for example: Ethereum address if deployed on Base Chain
- controller: 必须至少需要包含自己的did identifier，数组
- verificationMethod: 必须至少包含一个部署链上可以验证的method，数组
Optionals
- alsoKnownAs: 别名，数组
- authentication: 用于认证的验证方法，可以引用 verificationMethod 的 id 或直接定义方法，数组
- assertionMethod: 用于签名断言的验证方法，数组
- keyAgreement: 用于加密通信的验证方法，数组
- capabilityInvocation: 用于调用能力的验证方法，数组
- capabilityDelegation: 用于委托能力的验证方法，数组
- service: 服务端点数组，每个 item 包含 id、type、serviceEndpoint 等字段，数组
Method-specific DID Document Storage
did:xny不限制Document的存储位置，但是推荐使用链上和链下结合的存储方式
On-Chain Storage
所有的写操作在链上发起，链上必须存储和校验用户的权限信息，链上必须实现resolver，以为用户提供最高可信级别的did document数据。
Off-Chain Storage
为了提供完善的数据查询服务和更好的用户体验，链下需要存储所有的did操作历史信息和最新状态。
Verification Methods
新增验证方法在Verification Methods文档中说明
