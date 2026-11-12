import { Config } from '@remotion/cli/config';

// PNG frames and a low CRF: JPEG frames at the default quality soften UI text.
Config.setVideoImageFormat('png');
Config.setCrf(16);
Config.setOverwriteOutput(true);
