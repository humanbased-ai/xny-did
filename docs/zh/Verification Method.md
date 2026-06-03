EmailChallenge
邮箱接收挑战信息验证，比如验证码
{
      "id": "did:example:123#key-1",
      "type": "EmailChallenge",
      "controller": "did:example:123",
      "emailAddress": "name@email.com"
    }
推荐: 使用hash+salt对emailAddress进行隐藏，防止泄漏隐私信息
GoogleAuth
{
      "id": "did:example:123#key-1",
      "type": "GoogleAuth",
      "controller": "did:example:123",
      "googleOpenID": "1234"
    }
推荐: 使用hash+salt对googleOpenID进行隐藏，防止泄漏隐私信息
EthereumAddress
兼容现有的Ethereum钱包登录
{
      "id": "did:example:123#key-1",
      "type": "EthereumAddress",
      "controller": "did:example:123",
      "ethereumAddress": "1234"
    }
推荐: 使用hash+salt对ethereumAddress进行隐藏，防止泄漏隐私信息
TonAddress
兼容现有的Ton钱包登录
{
      "id": "did:example:123#key-1",
      "type": "TonAddress",
      "controller": "did:example:123",
      "tonAddress": "1234"
    }
推荐: 使用hash+salt对tonAddress进行隐藏，防止泄漏隐私信息