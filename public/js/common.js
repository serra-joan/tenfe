(() => {
    const DEFAULT_ERROR_MESSAGE = 'Alguna cosa ha anat malament. Torna-ho a intentar més tard.'

    function getTrainIdFromUrl() {
        const params = new URLSearchParams(window.location.search)
        return params.get('trainId') || null
    }

    // Check RG1/R11 before R1 to avoid substring matches
    function getLineFromId(id) {
        if (!id) return null
        if (id.includes('RG1-')) return 'RG1'
        if (id.includes('R11-')) return 'R11'
        if (id.includes('R1-')) return 'R1'
        return null
    }

    function restartRefreshCountdown(refreshTime, intervalId, elementId = 'refreshTime') {
        const refreshTimeEl = document.getElementById(elementId)
        if (!refreshTimeEl) return null

        let timeLeft = refreshTime
        refreshTimeEl.textContent = String(refreshTime)

        if (intervalId) clearInterval(intervalId)

        const countdownId = setInterval(() => {
            timeLeft--
            refreshTimeEl.textContent = String(timeLeft)

            if (timeLeft <= 0) clearInterval(countdownId)
        }, 1000)

        return countdownId
    }

    function toggleLineFilter(activeLines, line, buttonPrefix = 'filter-') {
        if (activeLines.has(line)) activeLines.delete(line)
        else activeLines.add(line)

        const btn = document.getElementById(`${buttonPrefix}${line}`)
        if (btn) btn.classList.toggle('line-filter-inactive', !activeLines.has(line))

        return activeLines.has(line)
    }

    function setErrorMessage(message = DEFAULT_ERROR_MESSAGE, clear = false, elementId = 'txtErrorMessage') {
        const errorMessage = document.getElementById(elementId)
        if (!errorMessage) return

        errorMessage.textContent = message

        if (clear) errorMessage.classList.add('hidden')
        else errorMessage.classList.remove('hidden')
    }

    function setLoading(isLoading, elementId = 'loading') {
        const loadingEl = document.getElementById(elementId)
        if (!loadingEl) return

        if (isLoading) loadingEl.classList.remove('hidden')
        else loadingEl.classList.add('hidden')
    }

    window.CommonFunctions = {
        getTrainIdFromUrl,
        getLineFromId,
        restartRefreshCountdown,
        toggleLineFilter,
        setErrorMessage,
        setLoading
    }
})()