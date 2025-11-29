<template>
  <header class="header">
    <h1>{{ $t('generic.welcome') }}</h1>
    <nav class="nav">
      <button @click="goBack">{{ $t('generic.back') }}</button>
      <button @click="openSettings">{{ $t('generic.settings.title') }}</button>
    </nav>
  </header>
</template>

<script>
export default {
  name: 'Header',
  methods: {
    goBack() {
      this.$router.back();
    },
    openSettings() {
      this.$router.push('/settings');
    },
  },
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
}

.nav {
  display: flex;
  gap: 0.5rem;
}
</style>
