<template>
  <div class="app">
    <h1>{{ $t('generic.welcome') }}</h1>
    <nav>
      <button @click="goBack">{{ $t('generic.back') }}</button>
      <button @click="saveData">{{ $t('generic.save') }}</button>
      <button @click="cancel">{{ $t('generic.cancel') }}</button>
    </nav>
    <section class="settings">
      <h2>{{ $t('generic.settings.title') }}</h2>
      <div class="notifications">
        <label>{{ $t('generic.settings.notifications') }}</label>
        <input type="checkbox" v-model="notificationsEnabled" />
      </div>
    </section>
    <div v-if="error" class="error">
      <p>{{ $t('generic.errors.notFound') }}</p>
      <p>{{ $t('generic.errors.serverError') }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      notificationsEnabled: false,
      error: null,
    };
  },
  methods: {
    goBack() {
      this.$router.back();
    },
    saveData() {
      // Save logic
    },
    cancel() {
      // Cancel logic
    },
  },
};
</script>
