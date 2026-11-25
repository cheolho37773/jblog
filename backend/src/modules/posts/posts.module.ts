import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { InternalPostsController } from './internal-posts.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TagsController } from './tags.controller';
import { TaxonomyService } from './taxonomy.service';

@Module({
  controllers: [
    PostsController,
    CategoriesController,
    TagsController,
    SearchController,
    InternalPostsController,
  ],
  providers: [PostsService, TaxonomyService, SearchService],
})
export class PostsModule {}
