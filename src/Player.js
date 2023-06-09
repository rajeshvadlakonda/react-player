import React, { Component } from 'react'

import { propTypes, defaultProps } from './props'
import { fadeVolume } from './utils'

const SEEK_ON_PLAY_EXPIRY = 5000

export default class Player extends Component {
  static displayName = 'Player'
  static propTypes = propTypes
  static defaultProps = defaultProps
  mounted = false
  isReady = false
  preloading = false
  startOnPlay = true
  seekOnPlay = null
  componentDidMount () {
    this.mounted = true
    const { url, activePlayer } = this.props
    if (url) {
      this.player.load(url)
    } else if (activePlayer.shouldPreload && activePlayer.shouldPreload(this.props)) {
      this.preloading = true
      this.player.load(activePlayer.preloadURL)
    }
  }
  componentWillUnmount () {
    this.player.stop()
    this.mounted = false
  }
  componentDidUpdate (prevProps) {
    const { activePlayer, url } = this.props
    if (prevProps.activePlayer !== activePlayer) {
      this.isReady = false
      this.seekOnPlay = null
      this.startOnPlay = true
      this.player.load(url, this.isReady)
    }
  }
  componentWillReceiveProps (nextProps) {
    // Invoke player methods based on incoming props
    const { activePlayer, url, playing, volume, muted, playbackRate } = this.props
    if (activePlayer !== nextProps.activePlayer) {
      this.player.stop()
      return // A new player is coming, so don't invoke any other methods
    }
    if (url !== nextProps.url) {
      this.player.load(nextProps.url, this.isReady)
    }
    if (url && !nextProps.url) {
      this.player.stop()
    }
    if (!playing && nextProps.playing) {
      this.player.play()
    }
    if (playing && !nextProps.playing) {
      this.player.pause()
    }
    if (volume !== nextProps.volume && !nextProps.muted) {
      if (this.cancelVolumeFade) {
        this.cancelVolumeFade()
      }
      if (nextProps.volumeFade) {
        this.cancelVolumeFade = fadeVolume(this.setVolume, volume, nextProps.volume, nextProps.volumeFade)
      } else {
        this.player.setVolume(nextProps.volume)
      }
    }
    if (muted !== nextProps.muted) {
      if (this.cancelVolumeFade) {
        this.cancelVolumeFade()
      }
      this.player.setVolume(nextProps.muted ? 0 : nextProps.volume)
    }
    if (playbackRate !== nextProps.playbackRate && this.player.setPlaybackRate) {
      this.player.setPlaybackRate(nextProps.playbackRate)
    }
  }
  setVolume = volume => {
    this.player.setVolume(volume)
  }
  getCurrentTime () {
    if (!this.isReady) return null
    return this.player.getCurrentTime()
  }
  getSecondsLoaded () {
    if (!this.isReady) return null
    return this.player.getSecondsLoaded()
  }
  getDuration () {
    if (!this.isReady) return null
    return this.player.getDuration()
  }
  seekTo (amount) {
    // When seeking before player is ready, store value and seek later
    if (!this.isReady && amount !== 0) {
      this.seekOnPlay = amount
      setTimeout(() => {
        this.seekOnPlay = null
      }, SEEK_ON_PLAY_EXPIRY)
      return
    }
    if (amount > 0 && amount < 1) {
      // Convert fraction to seconds based on duration
      const duration = this.player.getDuration()
      if (!duration) {
        console.warn('ReactPlayer: could not seek using fraction – duration not yet available')
        return
      }
      this.player.seekTo(duration * amount)
      return
    }
    this.player.seekTo(amount)
  }
  onPlay = () => {
    const { volume, muted, onStart, onPlay, playbackRate } = this.props
    if (this.startOnPlay) {
      if (this.player.setPlaybackRate) {
        this.player.setPlaybackRate(playbackRate)
      }
      this.player.setVolume(muted ? 0 : volume)
      onStart()
      this.startOnPlay = false
    }
    onPlay()
    if (this.seekOnPlay) {
      this.seekTo(this.seekOnPlay)
      this.seekOnPlay = null
    }
    this.onDurationCheck()
  }
  onReady = () => {
    if (!this.mounted) return
    const { onReady, playing } = this.props
    this.isReady = true
    this.loadingSDK = false
    onReady()
    if (playing || this.preloading) {
      this.preloading = false
      if (this.loadOnReady) {
        this.player.load(this.loadOnReady)
        this.loadOnReady = null
      } else {
        this.player.play()
      }
    }
    this.onDurationCheck()
  }
  onEnded = () => {
    const { activePlayer, loop, onEnded } = this.props
    if (activePlayer.loopOnEnded && loop) {
      this.seekTo(0)
    }
    onEnded()
  }
  onDurationCheck = () => {
    clearTimeout(this.durationCheckTimeout)
    const duration = this.getDuration()
    if (duration) {
      this.props.onDuration(duration)
    } else {
      this.durationCheckTimeout = setTimeout(this.onDurationCheck, 100)
    }
  }
  ref = player => {
    if (player) {
      this.player = player
    }
  }
  render () {
    const Player = this.props.activePlayer
    return (
      <Player
        {...this.props}
        ref={this.ref}
        onReady={this.onReady}
        onPlay={this.onPlay}
        onEnded={this.onEnded}
      />
    )
  }
}
