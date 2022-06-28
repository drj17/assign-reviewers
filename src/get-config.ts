import * as core from '@actions/core'
import fs from 'fs'
import yaml from 'js-yaml'

interface Group {
  name: string
  reviewerCount?: number
  usernames?: string[]
  teams?: string[]
}
export interface Config {
  groups: Group[]
}

export const getConfig = (): Config => {
  const configPath = core.getInput('config', { required: true })

  try {
    const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Config

    for (const group of config.groups) {
      if (!group.reviewerCount) {
        throw new Error('At least one  reviewer must be requested')
      }
    }

    return config
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }

  return { groups: [] }
}
