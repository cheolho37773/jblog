import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { InternalPostsController } from './internal-posts.controller';
import { PostsController } from './posts.controller';
import { SearchController } from './search.controller';
import { TagsController } from './tags.controller';

@Module({
  controllers: [
    PostsController,
    CategoriesController,
    TagsController,
    SearchController,
    InternalPostsController,
  ],
})
export class PostsModule {}
