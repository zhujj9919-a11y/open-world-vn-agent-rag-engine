# Re:0 Adventure Engine User Asset Overrides

把你自己准备的本地素材放在这里，扩展会优先使用这些文件。

- 角色头像：`avatars/<角色id>.png|jpg|jpeg|webp|gif`
- 场景背景：`scenes/<场景key>.png|jpg|jpeg|webp|gif`

放入文件后，在项目根目录运行：

```bash
/Users/mac/miniconda3/envs/sillytavern/bin/node scripts/build-re0-user-assets.mjs
```

然后刷新网页。系统会重新读取 `manifest.json`，优先显示本地覆盖素材。

常用角色 id：`protagonist`、`emilia`、`rem`、`ram`、`beatrice`、`roswaal`、`reinhard`、`felt`、`otto`、`lishelle`、`owen`、`mia`、`bellringer`、`protagonist`。

常用场景 key：`rain_bell`、`loot_house`、`royal_capital`、`archive`、`mansion`、`sanctuary`、`priestella`、`vollachia`、`snowfield`、`witch_dream`。
