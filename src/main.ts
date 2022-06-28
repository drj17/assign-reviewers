import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'
import { assignReviewers } from './assign-reviewers'
import { getConfig } from './get-config'

async function run(): Promise<void> {
  try {
    if (!process.env.GITHUB_REF) throw new Error('missing GITHUB_REF')
    if (!process.env.GITHUB_REPOSITORY)
      throw new Error('missing GITHUB_REPOSITORY')
    //comes from {{secrets.GITHUB_TOKEN}}
    const token = core.getInput('repo-token', { required: true })
    const config = getConfig()

    await assignReviewers(new Octokit({ auth: token }), config)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
