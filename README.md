# `@ubiquibot/conversation-rewards`

This is intended to be the proper implementation of comment incentives, based on our learnings from the first go-around. 

As of 28 February: test driven development to aggregate all necessary information based on a URL to an issue. 
- pass in closed as complete issue URL and receive all the timeline events and activities of all humans who helped close the issue as complete. 
- most importantly: this can inherit bot authentication and link pull requests to issues in private repositories. 

Be sure to review all `*.test.*` files for implementation details. 

## Data structure

```json
{
  "userName": {
    "total": 40.5,
    "task": {
      "reward": 37.5,
      "multiplier": 1
    },
    "comments": [
      {
        "content": "comment content",
        "url": "https://url-to-item",
        "type": 18,
        "score": {
          "formatting": {
            "content": {
              "p": {
                "count": 16,
                "score": 1
              }
            },
            "wordValue": 0.1,
            "formattingMultiplier": 1
          },
          "reward": 0.8,
          "relevance": 0.5
      }
    }]
  }
}
```

Reward formula: `((count * wordValue) * (score * formattingMultiplier) * n) * relevance + task.reward = total`

## Plugin configuration

Here is a possible valid configuration to enable this plugin. See [these files](./src/configuration/) for more details.


```yaml
plugin: ubiquibot/conversation-rewards
with:
    evmNetworkId: 100
    evmPrivateEncrypted: "encrypted-key"
    erc20RewardToken: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"
    dataCollection:
      maxAttempts: 10
      delayMs: 10000
    incentives:
      requirePriceLabel: true
      contentEvaluator:
      userExtractor:
        redeemTask: true
      dataPurge:
      formattingEvaluator:
        multipliers:
          - select: [ ISSUE_SPECIFICATION ]
            formattingMultiplier: 1
            symbols:
              "\\b\\w+\\b": 0.1
            scores: # Scores can be set for each item differently
              br: 0
              code: 1
              p: 1
              em: 0
              img: 0
              strong: 0
              blockquote: 0
              h1: 1
              h2: 1
              h3: 1
              h4: 1
              h5: 1
              h6: 1
              a: 1
              li: 1
              td: 1
              hr: 0
          - select: [ ISSUE_AUTHOR ]
            formattingMultiplier: 1
            symbols:
              "\\b\\w+\\b": 0.2
          - select: [ ISSUE_ASSIGNEE ]
            formattingMultiplier: 0
            symbols:
              "\\b\\w+\\b": 0
          - select: [ ISSUE_COLLABORATOR ]
            formattingMultiplier: 1
            symbols:
              "\\b\\w+\\b": 0.1
          - select: [ ISSUE_CONTRIBUTOR ]
            formattingMultiplier: 0.25
            symbols:
              "\\b\\w+\\b": 0.1
          - select: [ PULL_SPECIFICATION ]
            formattingMultiplier: 0
            symbols:
              "\\b\\w+\\b": 0
          - select: [ PULL_AUTHOR ]
            formattingMultiplier: 2
            symbols:
              "\\b\\w+\\b": 0.2
          - select: [ PULL_ASSIGNEE ]
            formattingMultiplier: 1
            symbols:
              "\\b\\w+\\b": 0.1
          - select: [ PULL_COLLABORATOR ]
            formattingMultiplier: 1
            symbols:
              "\\b\\w+\\b": 0.1
          - select: [ PULL_CONTRIBUTOR ]
            formattingMultiplier: 0.25
            symbols:
              "\\b\\w+\\b": 0.1
      permitGeneration:
      githubComment:
        post: true
        debug: false
```
