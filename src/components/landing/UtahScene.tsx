/** Dawn over the Wasatch. Ridgelines are generated, so they read as terrain rather than drawn shapes. Colours are art, not UI tokens. */
const RIDGES = [
  { d: 'M0 720L0 367Q32 360 48 356Q64 351 80 345Q96 339 112 342Q128 344 144 352Q160 360 176 368Q192 375 208 379Q224 383 240 381Q256 378 272 371Q288 363 304 358Q320 353 336 356Q352 358 368 359Q384 360 400 358Q416 356 432 347Q448 337 464 329Q480 321 496 314Q512 306 528 301Q544 296 560 295Q576 294 592 299Q608 304 624 303Q640 302 656 300Q672 298 688 289Q704 279 720 276Q736 273 752 279Q768 285 784 288Q800 290 816 292Q832 294 848 298Q864 301 880 302Q896 303 912 304Q928 305 944 304Q960 303 976 299Q992 295 1008 281Q1024 267 1040 262Q1056 256 1072 252Q1088 247 1104 249Q1120 251 1136 246Q1152 240 1168 232Q1184 224 1200 214Q1216 204 1232 195Q1248 185 1264 176Q1280 166 1296 174Q1312 181 1328 181Q1344 180 1360 176Q1376 171 1392 155Q1408 139 1424 120Q1440 101 1456 111Q1472 120 1488 121Q1504 122 1520 108Q1536 94 1552 93Q1568 92 1584 98L1600 104L1600 720Z', top: '#a9bccb', mist: '#d8dfe2', blur: 1.6 },
  { d: 'M0 720L0 443Q40 424 60 432Q80 440 100 443Q120 446 140 426Q160 406 180 392Q200 378 220 370Q240 362 260 352Q280 342 300 345Q320 348 340 362Q360 375 380 371Q400 367 420 358Q440 349 460 353Q480 356 500 356Q520 356 540 364Q560 371 580 378Q600 385 620 386Q640 387 660 385Q680 383 700 380Q720 377 740 367Q760 357 780 360Q800 362 820 365Q840 368 860 362Q880 356 900 342Q920 328 940 337Q960 345 980 345Q1000 345 1020 328Q1040 311 1060 313Q1080 314 1100 322Q1120 330 1140 327Q1160 324 1180 318Q1200 312 1220 308Q1240 303 1260 300Q1280 297 1300 301Q1320 305 1340 309Q1360 312 1380 304Q1400 296 1420 310Q1440 323 1460 334Q1480 344 1500 338Q1520 331 1540 317Q1560 303 1580 299L1600 295L1600 720Z', top: '#86a4b0', mist: '#d3dcd8', blur: 1 },
  { d: 'M0 720L0 516Q50 498 75 498Q100 498 125 496Q150 494 175 495Q200 496 225 493Q250 490 275 484Q300 477 325 475Q350 472 375 476Q400 480 425 486Q450 491 475 499Q500 506 525 507Q550 507 575 507Q600 506 625 509Q650 511 675 521Q700 530 725 530Q750 530 775 515Q800 500 825 493Q850 486 875 486Q900 486 925 491Q950 495 975 494Q1000 492 1025 477Q1050 462 1075 461Q1100 460 1125 453Q1150 445 1175 436Q1200 427 1225 426Q1250 424 1275 422Q1300 420 1325 423Q1350 425 1375 423Q1400 420 1425 416Q1450 412 1475 408Q1500 404 1525 405Q1550 405 1575 401L1600 397L1600 720Z', top: '#5b8a8c', mist: '#c9d8d0', blur: 0.5 },
  { d: 'M0 720L0 595Q64 580 96 586Q128 592 160 578Q192 564 224 563Q256 561 288 556Q320 550 352 556Q384 561 416 555Q448 549 480 554Q512 559 544 557Q576 555 608 555Q640 555 672 554Q704 553 736 555Q768 556 800 554Q832 551 864 549Q896 546 928 552Q960 558 992 558Q1024 558 1056 554Q1088 549 1120 548Q1152 546 1184 555Q1216 563 1248 556Q1280 549 1312 550Q1344 550 1376 546Q1408 541 1440 544Q1472 547 1504 550Q1536 552 1568 555L1600 557L1600 720Z', top: '#2f6f6a', mist: '#b9d0c6', blur: 0 },
];

export function UtahScene() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1600 720" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 -z-10 size-full text-surface">
      <defs>
        <linearGradient id="scene-sky" x2="0" y2="1">
          <stop offset="0" stopColor="#c9dde6" />
          <stop offset="0.45" stopColor="#e6e6e0" />
          <stop offset="0.75" stopColor="#f8dfc8" />
        </linearGradient>
        <radialGradient id="scene-sun" cx="0.74" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe9cf" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe9cf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scene-fade" x2="0" y2="1">
          <stop offset="0.72" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
        {RIDGES.map((r, i) => (
          <linearGradient key={i} id={`scene-ridge-${i}`} x2="0" y2="1">
            <stop offset="0.25" stopColor={r.top} />
            <stop offset="0.9" stopColor={r.mist} />
          </linearGradient>
        ))}
        {RIDGES.map((r, i) => (
          <filter key={i} id={`scene-haze-${i}`}><feGaussianBlur stdDeviation={r.blur} /></filter>
        ))}
      </defs>
      <rect width="1600" height="720" fill="url(#scene-sky)" />
      <rect width="1600" height="720" fill="url(#scene-sun)" />
      {RIDGES.map((r, i) => <path key={i} d={r.d} fill={`url(#scene-ridge-${i})`} filter={r.blur ? `url(#scene-haze-${i})` : undefined} />)}
      <rect width="1600" height="724" fill="url(#scene-fade)" />
    </svg>
  );
}
