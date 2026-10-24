# Pastport

**Experience the Past.**

Pastport is a browser extension that takes the internet back to any year you pick. Choose 2014, and the web only shows what existed on today's date in 2014. Tomorrow, your virtual date moves forward one day, just like it did back then.

## How it works

Pastport keeps a virtual clock. If today is October 24, 2026 and you travel to 2014, your virtual date is October 24, 2014. Every real day that passes moves it forward by one day. Anything published after your virtual date is hidden.

## Supported sites

| Site | Status |
| --- | --- |
| YouTube | In progress |
| More sites | Planned |

## Roadmap

### v0.1 (MVP)
- [x] Virtual clock with a year picker
- [x] Channel pages only show videos up to the virtual date
- [x] Friendly empty state when a channel has not started yet
- [ ] Search limited to the virtual date
- [ ] Hide newer comments and recommendations on watch pages
- [x] Hide Shorts and subscriber counts where they did not exist yet

### Later
- [ ] A home feed built from your subscriptions as they were back then
- [ ] Period themes that bring back the look of each era
- [ ] Support for more sites
- [ ] Firefox release

## Development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev       # opens a browser with the extension loaded
npm run build     # production build in .output/
npm test          # unit tests
```

Built with [WXT](https://wxt.dev), TypeScript and React.

## Contributing

Ideas, bug reports and pull requests are welcome. Please open an issue first for larger changes.

## License

[GPL-3.0](LICENSE). Pastport is free software, and any version you distribute must stay free too.

Pastport is not affiliated with YouTube or Google.
